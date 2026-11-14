/**
 * `@evinvest/sites-tools/next/kit` — the review kit's page (`app/avis/[slug]/page.tsx`) and its
 * document (`app/avis/layout.tsx`); its routes are `./next`'s `kitPhotoRoute` and
 * `kitEventsRoute`. A subpath of its own: the page's client module would otherwise land in every
 * route handler that imports `./next`.
 */
export { KitDocument } from "./KitDocument";
export { kitPage } from "./page";
