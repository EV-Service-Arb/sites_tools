import { GeistSans } from "geist/font/sans";
import type { ReactNode } from "react";

/**
 * `app/avis/layout.tsx`, a root layout of its own: the brands' is under `[locale]`, and the kit
 * wears none of the brand's styles. The language is the offer's, on the page (`ReviewKit`).
 */
export function KitDocument({ children }: { children: ReactNode }) {
  return (
    <html className={GeistSans.className}>
      <body style={{ margin: 0, background: "#fff" }}>{children}</body>
    </html>
  );
}
