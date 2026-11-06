import "server-only";
import { ingestBody, isOpaqueId, siteEvent, uuidV7, type BookingRequested, type LeadCreated } from "@evinvest/sites-contract";
import { channelOf, suspectOf, type Lead } from "../core/lead";
import type { ServerEnv } from "./env";
import { experimentsDeclaredBody, type DeclareOutcome, type ExperimentsDeclaration } from "./experiments-declared";
import { openWebhookOutbox, type TickReport, type WebhookOutbox, type WebhookOutboxOptions } from "./webhook-outbox";
import type { WebhookSigning } from "./webhook-signature";

/** The panel's ingest scheme, as the conductor checks it: the MAC covers `sa-ingest/v1.<timestamp>.<body>`. */
export const SA_INGEST_SIGNING: WebhookSigning = {
  prefix: "sa-ingest/v1.",
  headers: { keyId: "x-sa-key-id", timestamp: "x-sa-timestamp", signature: "x-sa-signature" },
};

/** `lead.created`'s sale: `flow`, and for a priced one its price, model day and an estimate's answers. */
function saleOf(lead: Pick<Lead, "flow" | "price">): Pick<LeadCreated, "flow" | "quoted_cents" | "pricing_valid_from" | "estimate_inputs"> {
  if (!lead.flow) return {};
  if (lead.flow === "quote" || !lead.price) return { flow: "quote" };
  const inputs = lead.flow === "estimate" && lead.price.inputs && Object.keys(lead.price.inputs).length > 0 ? { estimate_inputs: { ...lead.price.inputs } } : {};
  return { flow: lead.flow, quoted_cents: lead.price.cents, pricing_valid_from: lead.price.validFrom, ...inputs };
}

// The journal stores no U+0000, and the panel refuses the event that carries one.
const clean = (s: string): string => s.replaceAll("\u0000", "").trim();

/**
 * What the customer typed, kept apart from `properties`: the panel seals `pii`
 * and reads `name`, `phone` and `need` from it. The fields are capped by the
 * lead schema (200 characters, an extra its own `max`), far below the panel's
 * 16 KiB. A callback's consent stays in the leads file: the contract has no
 * field for it.
 */
function piiOf(lead: Lead, needLabel: (subject: string) => string): Record<string, string> {
  const pii: Record<string, string> = {};
  const put = (key: string, value: string) => {
    const v = clean(value);
    if (v !== "") pii[key] = v;
  };
  for (const [name, value] of Object.entries(lead.extras)) put(name, value);
  put("phone", lead.mobile);
  put("need", needLabel(lead.subject));
  put("locality", lead.locality);
  return pii;
}

/** Why `requestBooking` queued nothing. */
export type BookingQueued = { kind: "queued"; row: number } | { kind: "duplicate" } | { kind: "unqueued" };

export interface LeadWebhook {
  /**
   * `lead.created@1` for the lead, queued; returns the outbox row. The lead
   * is named by its `leadRef` (the panel's lead id, which a booking names
   * too); `locationId` is the point the form was posted from, when it is an
   * id the panel takes.
   */
  enqueue(lead: Lead, id: number, meta: { leadRef: string; analyticsId?: string }): number;
  tick(): Promise<TickReport>;
  start(intervalMs?: number): void;
  stop(): void;
  close(): void;
  /** The outbox's `requeueDead`: this target's dead rows back in the queue. */
  requeueDead(): number;
  /**
   * Queues `booking.requested@1` behind the lead's `lead.created`, through
   * the same outbox: not sent until that row is delivered, and a `409` /
   * `425` for it retried. Once per lead: a second request is a `duplicate`,
   * whatever it asks. `unqueued` when the lead's own row was never queued.
   */
  requestBooking(request: BookingRequested): BookingQueued;
  /**
   * Queues `experiments.declared@1` — the experiments this build runs — in
   * the same outbox. Experiments the panel would refuse are left out and
   * listed in `skipped`. `declareExperiments` is the safe wrapper for a start.
   */
  declareExperiments(experiments: ExperimentsDeclaration, summaries?: Readonly<Record<string, string>>): DeclareOutcome;
  readonly outbox: WebhookOutbox;
}

export interface LeadWebhookOptions extends WebhookOutboxOptions {
  /**
   * The job in the words the panel shows as the customer's request
   * (`pii.need`): `hot_water` is not one. A job the form no longer offers
   * stays as posted.
   */
  needLabel: (subject: string) => string;
}

/**
 * The lead webhook to the Service-Arb panel, or `null` when it is off: no
 * `LEAD_WEBHOOK_URL`. Built at boot by the brand, like the notifier, so a
 * broken setting fails startup rather than a lead. Every body is the kit's,
 * built with `@evinvest/sites-contract`'s `siteEvent`, and signed with the
 * key id it names as its source.
 */
export function leadWebhook(site: { brand: { id: string } }, env: Pick<ServerEnv, "leadsDb" | "leadWebhook">, options: LeadWebhookOptions): LeadWebhook | null {
  const { needLabel, ...outboxOptions } = options;
  if (!env.leadWebhook) return null;
  if (env.leadsDb.kind !== "sqlite") throw new Error("LEAD_WEBHOOK_URL: the webhook outbox needs the sqlite lead store");
  const outbox = openWebhookOutbox(env.leadsDb.path, { ...env.leadWebhook, signing: SA_INGEST_SIGNING }, outboxOptions);
  const now = options.now ?? Date.now;
  const sourceId = env.leadWebhook.keyId;
  const brandId = site.brand.id;
  const head = (subject: { brandId: string; leadId?: string; locationId?: string }) => {
    const at = new Date(now());
    return { id: uuidV7(at.getTime()), occurredAt: at, sourceId, subject };
  };
  return {
    outbox,
    requestBooking(request) {
      // The lead's own row, as `enqueue` refs it: the booking follows it, and
      // a lead never queued (a honeypot's) is never booked to the panel.
      const lead = `lead:${/^lead-(\d+)-/.exec(request.lead_ref)?.[1] ?? ""}`;
      if (!outbox.hasRef(lead)) return { kind: "unqueued" };
      const body = ingestBody(siteEvent("booking.requested@1", head({ brandId, leadId: request.lead_ref }), request));
      const row = outbox.enqueueOnce(JSON.stringify(body), `booking:${request.lead_ref}`, lead);
      return row === null ? { kind: "duplicate" } : { kind: "queued", row };
    },
    declareExperiments(experiments, summaries) {
      const { body, skipped } = experimentsDeclaredBody(experiments, { brandId, sourceId, at: new Date(now()), ...(summaries ? { summaries } : {}) });
      const row = outbox.enqueue(JSON.stringify(body), `experiments:${body.events.map(e => e.id).join(",")}`);
      return { kind: "queued", row, skipped };
    },
    enqueue(lead, id, meta) {
      const suspect = suspectOf(lead);
      const properties: LeadCreated = {
        channel: channelOf(lead),
        ...(lead.messageRef ? { message_ref: lead.messageRef } : {}),
        ...saleOf(lead),
        ...(suspect ? { suspect } : {}),
        ...(meta.analyticsId ? { analytics_id: meta.analyticsId } : {}),
      };
      const subject = { brandId, leadId: meta.leadRef, ...(lead.placeSlug !== null && isOpaqueId(lead.placeSlug) ? { locationId: lead.placeSlug } : {}) };
      const body = ingestBody(siteEvent("lead.created@1", head(subject), properties, piiOf(lead, needLabel)));
      return outbox.enqueue(JSON.stringify(body), `lead:${id}`);
    },
    tick: () => outbox.tick(),
    start: intervalMs => outbox.start(intervalMs),
    stop: () => outbox.stop(),
    close: () => outbox.close(),
    requeueDead: () => outbox.requeueDead(),
  };
}
