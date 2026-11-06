import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { leadRef, type Lead } from "../src/index";
import { bookingRoute } from "../src/next/index";
import { leadWebhook, openSqliteLeadStore, openWebhookOutbox, SA_INGEST_SIGNING, type LeadWebhook } from "../src/server/index";
import { testLead } from "../src/testing/index";
import { fixtureSite } from "./support/fixtures";

const site = fixtureSite("aquafix");
const URL_ = "http://panel.sa.svc.cluster.local/api/ingest/v1/events";
const NOW = Date.parse("2026-10-04T10:00:00Z");
const SUBMISSION = "0b6c3f9e-1d2a-4c5b-8e7f-9a0b1c2d3e4f";
const PRICED: Partial<Lead> = { flow: "estimate", price: { cents: 8400, validFrom: "2026-10-01" }, submissionId: SUBMISSION };

const hooks: LeadWebhook[] = [];
afterEach(() => {
  for (const h of hooks.splice(0)) h.close();
});

/** The panel: answers each body by its type, from a script per type. */
function panel(answers: Partial<Record<"lead.created" | "booking.requested", number[]>> = {}) {
  const sent: string[] = [];
  const bodies: { type: string; subject: unknown; properties: unknown }[] = [];
  const fetch = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
    const [event] = (JSON.parse(String(init?.body)) as { events: { type: string; subject: unknown; properties: unknown }[] }).events;
    if (!event) throw new Error("a body of one event");
    const type = event.type;
    sent.push(type);
    if (type === "booking.requested") bodies.push({ type, subject: event.subject, properties: event.properties });
    const script = answers[type as "lead.created" | "booking.requested"];
    return new Response(null, { status: (script && script.length > 1 ? script.shift() : script?.[0]) ?? 200 });
  });
  return { fetch, sent, bodies };
}

async function stand(options: { lead?: Partial<Lead>; queued?: boolean; panel?: ReturnType<typeof panel> } = {}) {
  const path = join(mkdtempSync(join(tmpdir(), "sites-tools-booking-")), "leads.db");
  const store = openSqliteLeadStore(path);
  const id = await store.insert(testLead({ ...PRICED, ...options.lead }));
  const clock = { t: NOW };
  const receiver = options.panel ?? panel();
  const hook = leadWebhook(site, { leadsDb: { kind: "sqlite", path }, leadWebhook: { url: URL_, keyId: "k", secret: "s" } }, {
    needLabel: subject => subject,
    fetch: receiver.fetch as unknown as typeof globalThis.fetch,
    now: () => clock.t,
    random: () => 0,
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  });
  if (!hook) throw new Error("expected the webhook on");
  hooks.push(hook);
  // The quote route queues the lead's `lead.created` before anything can book it.
  if (options.queued !== false) hook.enqueue(testLead({ ...PRICED, ...options.lead }), id, { leadRef: leadRef(id, SUBMISSION) });
  const route = bookingRoute({ env: () => ({ leadsDb: { kind: "sqlite", path } }), store: () => store, webhook: () => hook, now: () => NOW, log: { warn: vi.fn(), error: vi.fn() } });
  return { route, hook, bodies: receiver.bodies, clock, sent: receiver.sent, ref: leadRef(id, SUBMISSION) };
}

const post = (body: unknown, type = "application/json") => new Request("https://brand.fr/quote/booking", { method: "POST", headers: { "content-type": type }, body: typeof body === "string" ? body : JSON.stringify(body) });

describe("bookingRoute", () => {
  it("queues booking.requested once per lead", async () => {
    const { route, hook, bodies, ref } = await stand();
    const res = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2026-10-06", preferred_part: "morning" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, queued: true });
    expect(hook.outbox.rows()).toMatchObject([{ ref: "lead:1" }, { ref: `booking:${ref}`, state: "pending" }]);
    await hook.tick();
    await hook.tick();
    expect(bodies).toEqual([{ type: "booking.requested", subject: { brandId: "aquafix", leadId: ref }, properties: { lead_ref: ref, provider: "manual", preferred_date: "2026-10-06", preferred_part: "morning" } }]);

    const again = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }));
    expect(await again.json()).toEqual({ ok: true, queued: false });
    expect(hook.outbox.rows()).toHaveLength(2);
  });

  it("books nothing for a reference the submission id does not prove", async () => {
    const { route, ref } = await stand();
    expect((await route(post({ submission: "1b6c3f9e-1d2a-4c5b-8e7f-9a0b1c2d3e4f", lead_ref: ref, provider: "link" }))).status).toBe(404);
    expect((await route(post({ submission: SUBMISSION, lead_ref: "lead-1-00000000", provider: "link" }))).status).toBe(404);
    expect((await route(post({ lead_ref: ref, provider: "link" }))).status).toBe(422);
  });

  it("books only a priced lead", async () => {
    const { route, ref } = await stand({ lead: { flow: "quote" } });
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }))).status).toBe(409);
  });

  // Review of #185: a lead the panel never heard of must not be booked there — the panel would refuse it.
  it("queues nothing for a lead that was never queued to the panel", async () => {
    const { route, hook, bodies, ref } = await stand({ queued: false });
    const res = await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }));
    expect(await res.json()).toEqual({ ok: true, queued: false });
    expect(bodies).toEqual([]);
    expect(hook.outbox.rows()).toEqual([]);
  });

  // Review of #185: the outbox orders by the next attempt, not by the lead.
  it("sends the booking only once its lead's lead.created is delivered", async () => {
    const receiver = panel({ "lead.created": [503, 200] });
    const { route, hook, clock, sent, ref } = await stand({ panel: receiver });
    await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }));
    await hook.tick();
    expect(sent).toEqual(["lead.created"]);
    clock.t += 60_000;
    await hook.tick();
    await hook.tick();
    expect(sent).toEqual(["lead.created", "lead.created", "booking.requested"]);
    expect(hook.outbox.rows().map(r => r.state)).toEqual(["delivered", "delivered"]);
  });

  it("retries a booking the panel answers 409 or 425 (its lead not in yet), never parking it", async () => {
    const receiver = panel({ "booking.requested": [409, 425, 200] });
    const { route, hook, clock, sent, ref } = await stand({ panel: receiver });
    await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual" }));
    for (let i = 0; i < 4; i++) {
      await hook.tick();
      clock.t += 120_000;
    }
    expect(sent).toEqual(["lead.created", "booking.requested", "booking.requested", "booking.requested"]);
    expect(hook.outbox.rows().map(r => r.state)).toEqual(["delivered", "delivered"]);
  });

  it("refuses what is not booking.requested, or not JSON", async () => {
    const { route, ref } = await stand();
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "link", preferred_part: "morning" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", note: "free text" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2026-09-01" }))).status).toBe(422);
    expect((await route(post({ submission: SUBMISSION, lead_ref: ref, provider: "manual", preferred_date: "2028-10-01" }))).status).toBe(422);
    expect((await route(post("submission=x", "application/x-www-form-urlencoded"))).status).toBe(415);
    expect((await route(post("{not json"))).status).toBe(400);
    expect((await route(post({ submission: SUBMISSION, pad: "x".repeat(5000) }))).status).toBe(413);
  });
});

describe("the outbox file from before after_ref", () => {
  it("gains the column on open and keeps its rows", async () => {
    const path = join(mkdtempSync(join(tmpdir(), "sites-tools-outbox-old-")), "leads.db");
    const sqlite = process.getBuiltinModule("node:sqlite");
    const old = new sqlite.DatabaseSync(path);
    old.exec(`CREATE TABLE webhook_outbox (id INTEGER PRIMARY KEY AUTOINCREMENT, target TEXT NOT NULL, ref TEXT, body TEXT NOT NULL, created_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, next_attempt_at INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', last_error TEXT, done_at INTEGER)`);
    old.prepare("INSERT INTO webhook_outbox (target, ref, body, created_at, next_attempt_at) VALUES (?, 'lead:1', '{}', 0, 0)").run(URL_);
    old.close();
    const outbox = openWebhookOutbox(path, { url: URL_, keyId: "k", secret: "s", signing: SA_INGEST_SIGNING }, { fetch: vi.fn(async () => new Response(null, { status: 200 })), log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } });
    expect(outbox.enqueueOnce("{}", "booking:x", "lead:1")).toBe(2);
    expect(await outbox.tick()).toEqual({ delivered: 1, retried: 0, dead: 0 });
    expect(await outbox.tick()).toEqual({ delivered: 1, retried: 0, dead: 0 });
    outbox.close();
  });
});
