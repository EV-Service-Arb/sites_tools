import { faqPageNode } from "@/shared/lib/sites-tools";
import { placeMetadata } from "@/shared/lib/sites-tools/next";
import { Faq, JsonLd, Section } from "@/shared/lib/sites-tools/react";
import type { Metadata } from "next";
import { loadPlace } from "@/views/place/server";
import { EstimateCard } from "@/views/prices";
import { pricing } from "@/shared/config/env";
import { site } from "@/shared/config/site";

type Props = { params: Promise<{ locale: string; location: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { view, copy } = await loadPlace(params);
  const page = copy.t.pages.prices;
  return placeMetadata(site, view, "prices", { title: page.title(copy.f), description: page.description(copy.f) });
}

export default async function PricesPage({ params }: Props) {
  const [{ view, copy, renderedAt }, model] = await Promise.all([loadPlace(params), pricing.model()]);
  return (
    <main>
      <JsonLd data={faqPageNode(copy.t.faqs)} />
      <Section surface="card">
        <EstimateCard view={view} copy={copy} renderedAt={renderedAt} model={model} />
      </Section>
      <Section>
        <Faq items={copy.t.faqs} />
      </Section>
    </main>
  );
}
