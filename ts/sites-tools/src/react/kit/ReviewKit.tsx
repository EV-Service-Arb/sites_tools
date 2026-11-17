"use client";

import { useEffect, useState, type MouseEvent } from "react";
import type { KitDraft, KitOffer, KitOs, KitPhoto } from "../../core/kit";
import { WORDS, type Words } from "./review-kit-text";

const CSS = `
.kit{min-height:100dvh;display:flex;flex-direction:column;gap:16px;padding:20px 20px 24px;background:#fff;color:#0a0a0a;font-size:15px;line-height:1.4;-webkit-font-smoothing:antialiased;box-sizing:border-box;max-width:480px;margin:0 auto}
.kit *{box-sizing:border-box}
.kit svg{flex-shrink:0}
.kit-name{font-weight:600}
.kit h1{font-size:28px;line-height:1.15;font-weight:700;letter-spacing:-.02em;margin:4px 0 0}
.kit-muted{color:#6b6b6b}
.kit-small{font-size:12px;color:#6b6b6b}
.kit-row{display:flex;align-items:center;justify-content:space-between;gap:8px}
.kit-pager{display:flex;align-items:center;gap:4px;color:#6b6b6b;font-size:14px}
.kit-pager button{all:unset;box-sizing:border-box;cursor:pointer;padding:6px;display:flex}
.kit-pager button:disabled{opacity:.3;cursor:default}
.kit-card{border:1px solid #0a0a0a;border-radius:14px;overflow:hidden}
.kit-card textarea{all:unset;box-sizing:border-box;display:block;width:100%;padding:16px 16px 8px;font-size:17px;line-height:1.5;white-space:pre-wrap;field-sizing:content;min-height:4lh}
.kit-meta{padding:0 16px 12px}
.kit-photos{display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid #e5e5e5;background:#fafafa}
.kit-photos img{width:48px;height:48px;object-fit:cover;border-radius:8px;background:#e5e5e5}
.kit-save{all:unset;box-sizing:border-box;white-space:nowrap;cursor:pointer;flex:1 0 auto;justify-content:center;display:flex;align-items:center;gap:8px;padding:10px 12px;font-size:14px;border:1px solid #0a0a0a;border-radius:10px;background:#fff;font-weight:600}
.kit-save:disabled{opacity:.4;cursor:default}
.kit-push{flex:1}
.kit-cta{display:flex;align-items:center;justify-content:center;gap:10px;min-height:56px;border-radius:14px;background:#0a0a0a;color:#fff;font-size:18px;font-weight:600;text-decoration:none}
.kit-center{text-align:center}
.kit-own{color:#0a0a0a;font-weight:500;text-underline-offset:3px}
.kit-tap{display:flex;flex-direction:column;gap:14px;padding:22px;border-radius:20px;background:#0a0a0a;color:#fff;text-decoration:none}
.kit-tap strong{display:flex;align-items:center;gap:10px;font-size:24px;line-height:1.2;letter-spacing:-.01em}
.kit-tap q{font-size:17px;line-height:1.5;color:#ededed}
.kit-tap span{font-size:13px;color:#a3a3a3}
`;

const svg = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const CopyIcon = () => (
  <svg {...svg}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
);
const SaveIcon = () => (
  <svg {...svg} width={18} height={18}>
    <path d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" />
  </svg>
);
const Chevron = ({ back }: { back?: boolean }) => (
  <svg {...svg} width={16} height={16}>
    <path d={back ? "m15 6-6 6 6 6" : "m9 6 6 6-6 6"} />
  </svg>
);

export interface ReviewKitProps {
  offer: KitOffer;
  os: KitOs;
  /** Where a tap goes: Google's review form, per OS. */
  link: string;
  /** `/avis/<slug>`: the photos and the events are under it. */
  base: string;
}

function beacon(base: string, event: { view: string; copied: number } | { view: string; saved: number[] }): void {
  if (!navigator.sendBeacon(`${base}/events`, JSON.stringify(event))) console.error("review kit: the browser refused the beacon", event);
}

/**
 * The copy runs in the tap itself, before the anchor's own navigation: a browser lets a page
 * write the clipboard only inside a gesture, so nothing is awaited before it.
 */
function copyThenGo(base: string, view: string, draft: number, text: string) {
  return (_: MouseEvent<HTMLAnchorElement>) => {
    // The page is leaving for Google: a refused copy can only be told to the console.
    navigator.clipboard.writeText(text).catch((error: unknown) => console.error("review kit: the copy was refused", error));
    beacon(base, { view, copied: draft });
  };
}

const photoUrl = (base: string, view: string, p: KitPhoto) => `${base}/photos/${p.id}.jpg?view=${view}`;

/** iPhone: `share({files})` must run in the tap, so the files are fetched before it. */
function useFiles(os: KitOs, base: string, view: string, photos: KitPhoto[]): File[] | null {
  const [files, setFiles] = useState<{ of: KitPhoto[]; files: File[] } | null>(null);
  useEffect(() => {
    if (os !== "ios" || photos.length === 0) return;
    let live = true;
    void Promise.all(
      photos.map(async p => {
        const res = await fetch(photoUrl(base, view, p));
        if (!res.ok) throw new Error(`review kit: photo ${p.id}: ${res.status}`);
        return new File([await res.blob()], `photo-${p.id}.jpg`, { type: "image/jpeg" });
      }),
    ).then(got => live && setFiles({ of: photos, files: got }));
    return () => {
      live = false;
    };
  }, [os, base, view, photos]);
  return files?.of === photos ? files.files : null;
}

function SavePhotos({ os, base, view, photos, label }: { os: KitOs; base: string; view: string; photos: KitPhoto[]; label: string }) {
  const files = useFiles(os, base, view, photos);
  const saved = () => beacon(base, { view, saved: photos.map(p => p.id) });
  const save = () => {
    if (os !== "ios") {
      for (const p of photos) {
        const a = document.createElement("a");
        a.href = photoUrl(base, view, p);
        a.download = `photo-${p.id}.jpg`;
        a.click();
      }
      saved();
      return;
    }
    if (!files) throw new Error("review kit: the button is disabled until the files are in");
    navigator.share({ files }).then(saved, (error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return; // they closed the sheet: nothing saved
      throw error;
    });
  };
  return (
    <button type="button" className="kit-save" onClick={save} disabled={os === "ios" && !files}>
      <SaveIcon />
      {label}
    </button>
  );
}

function Drafts({ offer, os, link, base, w }: ReviewKitProps & { w: Words }) {
  const [at, setAt] = useState(0);
  const [edited, setEdited] = useState<Record<number, string>>({});
  const draft = offer.drafts[at] as KitDraft;
  const text = edited[draft.id] ?? draft.text;
  return (
    <>
      <h1>{w.title}</h1>
      <p className="kit-muted" style={{ margin: 0 }}>
        {w.intro}
      </p>
      <div className="kit-row">
        <strong>{w.start}</strong>
        {offer.drafts.length > 1 && (
          <div className="kit-pager">
            <button type="button" aria-label={w.prev} disabled={at === 0} onClick={() => setAt(at - 1)}>
              <Chevron back />
            </button>
            {w.of(at + 1, offer.drafts.length)}
            <button type="button" aria-label={w.next} disabled={at === offer.drafts.length - 1} onClick={() => setAt(at + 1)}>
              <Chevron />
            </button>
          </div>
        )}
      </div>
      <div className="kit-card">
        <textarea aria-label={w.start} value={text} onChange={e => setEdited({ ...edited, [draft.id]: e.target.value })} />
        <div className="kit-row kit-meta kit-small">
          <span>✎ {w.edit}</span>
          <span>{w.chars(text.length)}</span>
        </div>
        {draft.photos.length > 0 && (
          <div className="kit-photos">
            {draft.photos.map(p => (
              <img key={p.id} src={photoUrl(base, offer.view, p)} width={p.width} height={p.height} alt="" />
            ))}
            <SavePhotos os={os} base={base} view={offer.view} photos={draft.photos} label={w.save(draft.photos.length)} />
          </div>
        )}
      </div>
      {draft.photos.length > 0 && <p className="kit-small" style={{ margin: 0 }}>{w.savedNote}</p>}
      <div className="kit-push" />
      <a className="kit-cta" href={link} onClick={copyThenGo(base, offer.view, draft.id, text)}>
        <CopyIcon />
        {w.cta}
      </a>
      <p className="kit-small kit-center" style={{ margin: 0 }}>
        {w.ctaHint}
      </p>
      <a className="kit-own kit-center" href={link}>
        {w.own}
      </a>
    </>
  );
}

function OneTap({ offer, link, base, w }: ReviewKitProps & { w: Words }) {
  const draft = offer.drafts[0] as KitDraft;
  return (
    <a className="kit-tap" href={link} onClick={copyThenGo(base, offer.view, draft.id, draft.text)}>
      <strong>
        <CopyIcon />
        {w.oneTap}
      </strong>
      <q>{draft.text}</q>
      <span>{w.oneTapHint}</span>
    </a>
  );
}

/** The reviewer's page: the drafts to start from (13d) or the one tap (13f). Neutral: the brand is only a name. */
export function ReviewKit(props: ReviewKitProps) {
  const w = WORDS[props.offer.lang];
  return (
    <main className="kit" lang={props.offer.lang}>
      <title>{props.offer.name}</title>
      <meta name="robots" content="noindex, nofollow" />
      <style>{CSS}</style>
      <div className="kit-name">{props.offer.name}</div>
      {props.offer.target === "one_tap" ? <OneTap {...props} w={w} /> : <Drafts {...props} w={w} />}
    </main>
  );
}
