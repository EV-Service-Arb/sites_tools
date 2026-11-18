import { headers } from "next/headers.js";
import { notFound, redirect } from "next/navigation.js";
import type { ReactElement } from "react";
import { kitOsOf, kitReviewLink, parseKitOffer } from "../../core/kit";
import type { Site } from "../../core/site";
import { conductor, type KitDeps } from "../kit-route";
import { ReviewKit } from "../../react/kit/ReviewKit";

interface KitPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * `app/avis/[slug]/page.tsx`: the conductor's offer for the place (`qr=1` when the URL has
 * `?qr`, and the kit whose QR it was, `&kit`), then Google's form at once or the page. Every load is a view the conductor leases, so
 * the brand's file says `export const dynamic = "force-dynamic"`.
 */
export function kitPage<L extends string, P extends string>(site: Site<L, P>, deps: KitDeps): (props: KitPageProps) => Promise<ReactElement> {
  return async ({ params, searchParams }) => {
    const { slug } = await params;
    if (!site.placeSlugs.includes(slug)) notFound();
    const query = new URLSearchParams({ brand: site.brand.id, slug });
    const { qr, kit } = await searchParams;
    if (qr !== undefined) query.set("qr", "1");
    // a kit's QR: the view it opens is tagged with that kit, so a GBP counted in two kits is still one view
    if (typeof kit === "string" && /^\d+$/.test(kit)) query.set("kit", kit);
    const res = await conductor(deps).get(`/api/kit/v1/offer?${query}`);
    if (res.status === 404) notFound();
    if (res.status !== 200) throw new Error(`the conductor's kit offer for ${site.brand.id}/${slug}: ${res.status} ${await res.text()}`);
    const offer = parseKitOffer(await res.json());
    const os = kitOsOf((await headers()).get("user-agent") ?? ""); // no user agent: no OS to pick a link for
    const link = kitReviewLink(os, offer);
    if (offer.target === "google") redirect(link);
    return <ReviewKit offer={offer} os={os} link={link} base={`/avis/${slug}`} />;
  };
}
