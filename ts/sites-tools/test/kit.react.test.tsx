import { createHmac } from "node:crypto";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { KitOffer } from "../src/core/kit";
import { kitEventsRoute, kitPhotoRoute } from "../src/next/index";
import { kitPage } from "../src/next/kit/page";
import { fixtureSite } from "./support/fixtures";

const ua = { current: "" };
vi.mock("next/headers.js", () => ({ headers: async () => new Headers({ "user-agent": ua.current }) }));

const ANDROID = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/156.0 Mobile Safari/537.36";
const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 Version/19.0 Mobile/15E148 Safari/604.1";

const site = fixtureSite("aquafix");
const KEY = { url: "http://conductor.sa.svc.cluster.local/api/ingest/v1/events", keyId: "aquafix-site", secret: "s3cret" };
const NOW = Date.parse("2026-11-14T10:00:00Z");
const VIEW = "0193a1b2-c3d4-7e5f-8a9b-0c1d2e3f4a5b";
const OFFER: KitOffer = {
  target: "drafts",
  place_id: "ChIJ-royat",
  name: "Aquafix Plombier Royat",
  lang: "en",
  review_uri: "https://www.google.com/maps/place//data=!4m3!3m2!1s0x1:0x2!12e1",
  view: VIEW,
  drafts: [
    { id: 11, text: "Came on a Sunday.", photos: [{ id: 5, width: 2048, height: 1536 }] },
    { id: 12, text: "Fair price.", photos: [] },
  ],
};

/** The conductor: checks every MAC as ingest does, answers from `answer`. */
function conductor(answer: (path: string, init: RequestInit) => Response) {
  const calls: { path: string; method: string; body?: string }[] = [];
  const fetch = vi.fn(async (url: string | URL | Request, init: RequestInit = {}) => {
    const u = new URL(String(url));
    const path = `${u.pathname}${u.search}`;
    const h = new Headers(init.headers);
    const signed = init.method === "GET" ? `GET ${path}` : String(init.body);
    const mac = createHmac("sha256", KEY.secret).update(`sa-ingest/v1.${h.get("x-sa-timestamp")}.${signed}`).digest("hex");
    expect(h.get("x-sa-key-id")).toBe(KEY.keyId);
    expect(h.get("x-sa-signature"), `the MAC over ${signed}`).toBe(mac);
    expect(u.origin).toBe("http://conductor.sa.svc.cluster.local");
    calls.push({ path, method: String(init.method), ...(init.body ? { body: String(init.body) } : {}) });
    return answer(path, init);
  });
  return { calls, deps: { env: () => ({ leadWebhook: KEY }), fetch: fetch as unknown as typeof globalThis.fetch, now: () => NOW } };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

async function page(offer: KitOffer | Response, query: Record<string, string> = {}, slug = "royat") {
  const c = conductor(() => (offer instanceof Response ? offer : json(200, offer)));
  const el = await kitPage(site, c.deps)({ params: Promise.resolve({ slug }), searchParams: Promise.resolve(query) });
  return { el, calls: c.calls };
}

/** What a thrown `redirect()` / `notFound()` says. */
async function thrown(p: Promise<unknown>): Promise<string> {
  const e = await p.then(
    () => null,
    (error: unknown) => error as { digest?: string },
  );
  return e?.digest ?? "nothing thrown";
}

describe("the page", () => {
  beforeEach(() => {
    ua.current = ANDROID;
  });

  it("asks the conductor for the place's offer, signed over the method and the path, the QR said by qr=1", async () => {
    const { calls } = await page(OFFER, { qr: "" });
    expect(calls).toEqual([{ method: "GET", path: "/api/kit/v1/offer?brand=aquafix&slug=royat&qr=1" }]);
  });

  it("sends Google's form target straight to the form, per OS", async () => {
    const google = { ...OFFER, target: "google" as const, drafts: [] };
    expect(await thrown(page(google))).toContain(
      "intent://search.google.com/local/writereview/mobile?placeid=ChIJ-royat#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=https%3A%2F%2Fsearch.google.com%2Flocal%2Fwritereview%3Fplaceid%3DChIJ-royat;end",
    );
    ua.current = IPHONE;
    expect(await thrown(page(google))).toContain(OFFER.review_uri);
  });

  it("is a 404 for a place the kit is off for, and asks nothing for a slug the site has not", async () => {
    expect(await thrown(page(json(404, { error: "the kit is off" })))).toContain("404");
    const c = conductor(() => json(200, OFFER));
    expect(await thrown(kitPage(site, c.deps)({ params: Promise.resolve({ slug: "nowhere" }), searchParams: Promise.resolve({}) }))).toContain("404");
    expect(c.calls).toEqual([]);
  });

  it("refuses an offer outside the contract", async () => {
    await expect(page({ ...OFFER, drafts: [] })).rejects.toThrow("drafts with 0 drafts");
  });
});

describe("the tap", () => {
  let reachedDefault: boolean[] = [];
  const onWindowClick = (e: Event) => {
    reachedDefault.push(!e.defaultPrevented);
    e.preventDefault(); // keeps jsdom from navigating
  };
  const writeText = vi.fn(async (_: string) => {});
  const sendBeacon = vi.fn((_url: string, _body: string) => true);
  beforeEach(() => {
    reachedDefault = [];
    writeText.mockClear();
    sendBeacon.mockClear();
    window.addEventListener("click", onWindowClick);
    Object.assign(navigator, { clipboard: { writeText }, sendBeacon });
    vi.stubGlobal("fetch", async () => new Response("jpeg"));
  });
  afterEach(() => {
    window.removeEventListener("click", onWindowClick);
    vi.unstubAllGlobals();
  });

  it("copies the draft as edited and tells the conductor, in the click, and lets the link go to Google", async () => {
    ua.current = IPHONE;
    render((await page(OFFER)).el);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Fair price, on time." } });
    reachedDefault = [];
    const tap = screen.getByRole("link", { name: "Copy & open Google" });
    expect(tap.getAttribute("href")).toBe(OFFER.review_uri);
    fireEvent.click(tap);
    expect(writeText.mock.calls).toEqual([["Fair price, on time."]]);
    expect(sendBeacon.mock.calls).toEqual([["/avis/royat/events", JSON.stringify({ view: VIEW, copied: 12 })]]);
    expect(reachedDefault).toEqual([true]);
  });

  it("one tap: the first draft only, copied as it is", async () => {
    render((await page({ ...OFFER, target: "one_tap" })).el);
    fireEvent.click(screen.getByRole("link", { name: /Tap to review on Google/ }));
    expect(writeText.mock.calls).toEqual([["Came on a Sunday."]]);
    expect(sendBeacon.mock.calls).toEqual([["/avis/royat/events", JSON.stringify({ view: VIEW, copied: 11 })]]);
    expect(reachedDefault).toEqual([true]);
  });

  it("Android saves the photos by download, then says they were saved", async () => {
    ua.current = ANDROID;
    render((await page(OFFER)).el);
    const downloads: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.getAttribute("href")} as ${this.download}`);
    });
    fireEvent.click(screen.getByRole("button", { name: "Save the photo" }));
    click.mockRestore();
    expect(downloads).toEqual([`/avis/royat/photos/5.jpg?view=${VIEW} as photo-5.jpg`]);
    expect(sendBeacon.mock.calls).toEqual([["/avis/royat/events", JSON.stringify({ view: VIEW, saved: [5] })]]);
  });

  it("iPhone hands the fetched photos to the share sheet in the tap, and says they were saved once it closes on a save", async () => {
    ua.current = IPHONE;
    const share = vi.fn(async (_: { files: File[] }) => {});
    Object.assign(navigator, { share });
    render((await page(OFFER)).el);
    const button = screen.getByRole("button", { name: "Save the photo" });
    await vi.waitFor(() => expect(button.hasAttribute("disabled")).toBe(false));
    fireEvent.click(button);
    expect(share.mock.calls.map(([d]) => d.files.map(f => `${f.name} ${f.type}`))).toEqual([["photo-5.jpg image/jpeg"]]);
    await vi.waitFor(() => expect(sendBeacon.mock.calls).toEqual([["/avis/royat/events", JSON.stringify({ view: VIEW, saved: [5] })]]));
  });
});

describe("the routes", () => {
  it("forwards an event signed over its body, whatever type the beacon gave it, and passes the answer on", async () => {
    const c = conductor(() => new Response(null, { status: 204 }));
    const body = JSON.stringify({ view: VIEW, saved: [5, 6] });
    const res = await kitEventsRoute(c.deps)(new Request("https://aquafix.top/avis/royat/events", { method: "POST", headers: { "content-type": "text/plain" }, body }));
    expect(res.status).toBe(204);
    expect(c.calls).toEqual([{ method: "POST", path: "/api/kit/v1/events", body }]);
  });

  it("refuses anything but an event without calling out", async () => {
    const c = conductor(() => new Response(null, { status: 204 }));
    for (const body of ["nope", JSON.stringify({ view: VIEW, copied: 1, extra: 1 }), JSON.stringify({ view: "x", copied: 1 }), JSON.stringify({ view: VIEW, saved: [] })]) {
      const res = await kitEventsRoute(c.deps)(new Request("https://aquafix.top/avis/royat/events", { method: "POST", body }));
      expect(res.status, body).toBe(400);
    }
    expect(c.calls).toEqual([]);
  });

  it("proxies a photo the view was offered, and nothing for a name that is not one", async () => {
    const c = conductor(path => (path.startsWith("/api/kit/v1/photos/5.jpg") ? new Response("jpeg", { headers: { "content-type": "image/jpeg" } }) : json(404, { error: "not offered" })));
    const get = (photo: string, view = VIEW) => kitPhotoRoute(c.deps)(new Request(`https://aquafix.top/avis/royat/photos/${photo}?view=${view}`), { params: Promise.resolve({ photo }) });
    const ok = await get("5.jpg");
    expect([ok.status, ok.headers.get("content-type"), await ok.text()]).toEqual([200, "image/jpeg", "jpeg"]);
    expect((await get("6.jpg")).status).toBe(404);
    expect((await get("../5.jpg")).status).toBe(404);
    expect((await get("5.jpg", "x")).status).toBe(404);
    expect(c.calls.map(call => call.path)).toEqual([`/api/kit/v1/photos/5.jpg?view=${VIEW}`, `/api/kit/v1/photos/6.jpg?view=${VIEW}`]);
  });
});
