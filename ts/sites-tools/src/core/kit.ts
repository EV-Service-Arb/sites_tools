/**
 * The review kit's offer as the conductor answers it (`GET /api/kit/v1/offer`), checked, and the
 * link a tap opens per OS (site_conductor `docs/review_kit.typ` §2).
 */
export type KitTarget = "google" | "drafts" | "one_tap";
export type KitOs = "android" | "ios" | "other";

export interface KitPhoto {
  id: number;
  width: number;
  height: number;
}

export interface KitDraft {
  id: number;
  text: string;
  photos: KitPhoto[];
}

export interface KitOffer {
  target: KitTarget;
  place_id: string;
  name: string;
  lang: "fr" | "en";
  review_uri: string;
  view: string;
  drafts: KitDraft[];
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function fail(why: string): never {
  throw new Error(`the conductor's kit offer: ${why}`);
}

const isId = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0;
const isSize = isId;

function photo(v: unknown): KitPhoto {
  const p = v as Partial<KitPhoto> | null;
  if (!p || !isId(p.id) || !isSize(p.width) || !isSize(p.height)) fail(`a photo is not {id, width, height}: ${JSON.stringify(v)}`);
  return { id: p.id, width: p.width, height: p.height };
}

function draft(v: unknown): KitDraft {
  const d = v as Partial<KitDraft> | null;
  if (!d || !isId(d.id) || typeof d.text !== "string" || d.text.trim() === "" || !Array.isArray(d.photos)) fail(`a draft is not {id, text, photos}: ${JSON.stringify(v)}`);
  return { id: d.id, text: d.text, photos: d.photos.map(photo) };
}

/** Throws on anything but the contract's shape: the page renders nothing it did not check. */
export function parseKitOffer(v: unknown): KitOffer {
  const o = v as Partial<Record<keyof KitOffer, unknown>> | null;
  if (!o || typeof o !== "object") fail("not an object");
  const { target, place_id, name, lang, review_uri, view, drafts } = o;
  if (target !== "google" && target !== "drafts" && target !== "one_tap") fail(`target ${String(target)}`);
  // It goes into an intent's path and a query unescaped.
  if (typeof place_id !== "string" || !/^[A-Za-z0-9_-]{1,256}$/.test(place_id)) fail(`place_id ${String(place_id)}`);
  if (typeof name !== "string" || name.trim() === "") fail("name");
  if (lang !== "fr" && lang !== "en") fail(`lang ${String(lang)}`);
  if (typeof review_uri !== "string" || !review_uri.startsWith("https://")) fail(`review_uri ${String(review_uri)}`);
  if (typeof view !== "string" || !UUID.test(view)) fail(`view ${String(view)}`);
  if (!Array.isArray(drafts) || drafts.length > 6) fail("drafts is not a list of at most 6");
  const parsed = drafts.map(draft);
  if (target === "google" ? parsed.length !== 0 : parsed.length === 0) fail(`${target} with ${parsed.length} drafts`);
  return { target, place_id, name, lang, review_uri, view, drafts: parsed };
}

/** iPadOS asks as a Mac: it gets the web form, as a desktop does. */
export function kitOsOf(userAgent: string): KitOs {
  if (/Android/i.test(userAgent)) return "android";
  if (/iPhone|iPod/.test(userAgent)) return "ios";
  return "other";
}

/** Android: Maps' review form by intent, the browser form without Maps; iPhone: Places' `writeAReviewUri`. */
export function kitReviewLink(os: KitOs, offer: Pick<KitOffer, "place_id" | "review_uri">): string {
  const web = `https://search.google.com/local/writereview?placeid=${offer.place_id}`;
  switch (os) {
    case "android":
      return `intent://search.google.com/local/writereview/mobile?placeid=${offer.place_id}#Intent;scheme=https;package=com.google.android.apps.maps;S.browser_fallback_url=${encodeURIComponent(web)};end`;
    case "ios":
      return offer.review_uri;
    case "other":
      return web;
  }
}
