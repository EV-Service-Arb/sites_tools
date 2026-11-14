import { UUID } from "../core/kit";
import type { ServerEnv } from "../server/env";
import { SA_INGEST_SIGNING } from "../server/lead-webhook";
import { signatureHeaders } from "../server/webhook-signature";

/**
 * The review kit's two routes, mounted under `app/avis/[slug]/` beside its page (`./next/kit`'s
 * `kitPage`). Every call to the conductor, the page's too, is signed with the landing's ingest
 * key, as `leadWebhook`'s posts are, at the same base URL; a GET's MAC is over `GET <path?query>`
 * in place of a body.
 *
 * ```ts
 * // app/avis/[slug]/photos/[photo]/route.ts
 * export const GET = kitPhotoRoute({ env: serverEnv });
 * // app/avis/[slug]/events/route.ts
 * export const POST = kitEventsRoute({ env: serverEnv });
 * ```
 */
export interface KitDeps {
  env: () => Pick<ServerEnv, "leadWebhook">;
  fetch?: typeof globalThis.fetch;
  now?: () => number;
}

const MAX_EVENT_BODY = 4 * 1024;

export function conductor(deps: KitDeps) {
  const hook = deps.env().leadWebhook;
  if (!hook) throw new Error("the review kit needs LEAD_WEBHOOK_URL, LEAD_WEBHOOK_KEY_ID and LEAD_WEBHOOK_SECRET: it calls the conductor signed");
  const send = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  const signed = (pathAndQuery: string, init: { method: "GET" } | { method: "POST"; body: string }) => {
    const mac = init.method === "GET" ? `GET ${pathAndQuery}` : init.body;
    return send(new URL(pathAndQuery, hook.url), {
      ...init,
      cache: "no-store",
      headers: { ...signatureHeaders(SA_INGEST_SIGNING, hook, mac, now()), ...(init.method === "POST" ? { "content-type": "application/json" } : {}) },
    });
  };
  return {
    get: (pathAndQuery: string) => signed(pathAndQuery, { method: "GET" }),
    post: (path: string, body: string) => signed(path, { method: "POST", body }),
  };
}

/** The conductor's answer as it came: its status, its body, its type when it had one. */
async function passOn(res: Response): Promise<Response> {
  const type = res.headers.get("content-type");
  return new Response(res.status === 204 ? null : await res.text(), { status: res.status, headers: { ...(type ? { "content-type": type } : {}), "cache-control": "no-store" } });
}

const notOffered = () => new Response(JSON.stringify({ error: "not offered" }), { status: 404, headers: { "content-type": "application/json" } });

/** `GET /avis/<slug>/photos/<id>.jpg?view=<uuid>`: same origin, so `<a download>` saves it. */
export function kitPhotoRoute(deps: KitDeps): (req: Request, ctx: { params: Promise<{ photo: string }> }) => Promise<Response> {
  return async (req, { params }) => {
    const id = /^(\d{1,15})\.jpg$/.exec((await params).photo)?.[1];
    const view = new URL(req.url).searchParams.get("view");
    if (id === undefined || view === null || !UUID.test(view)) return notOffered();
    const res = await conductor(deps).get(`/api/kit/v1/photos/${id}.jpg?view=${view}`);
    if (res.status !== 200) return passOn(res);
    return new Response(res.body, { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=900" } });
  };
}

function eventOf(v: unknown): { view: string; copied: number } | { view: string; saved: number[] } | null {
  const isId = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) > 0;
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  const keys = Object.keys(e).sort().join(",");
  if (typeof e.view !== "string" || !UUID.test(e.view)) return null;
  if (keys === "copied,view" && isId(e.copied)) return { view: e.view, copied: e.copied };
  if (keys === "saved,view" && Array.isArray(e.saved) && e.saved.length > 0 && e.saved.length <= 64 && e.saved.every(isId)) return { view: e.view, saved: e.saved };
  return null;
}

/** `POST /avis/<slug>/events`: a beacon's `{view, copied}` or `{view, saved}`, its type whatever it sent. */
export function kitEventsRoute(deps: KitDeps): (req: Request) => Promise<Response> {
  return async req => {
    const text = await req.text();
    let event: ReturnType<typeof eventOf> = null;
    try {
      event = text.length <= MAX_EVENT_BODY ? eventOf(JSON.parse(text)) : null;
    } catch {
      // Not JSON: refused below like any other body that is not an event.
    }
    if (event === null) return new Response(JSON.stringify({ error: "not {view, copied} or {view, saved}" }), { status: 400, headers: { "content-type": "application/json" } });
    return passOn(await conductor(deps).post("/api/kit/v1/events", JSON.stringify(event)));
  };
}
