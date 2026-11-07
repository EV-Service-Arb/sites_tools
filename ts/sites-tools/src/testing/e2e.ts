import type { Expect, Page, TestType } from "@playwright/test";
import { defineFigmaSuite, settle, type Section as FigmaSection } from "@evinvest/figma-render";

export { defineFigmaSuite, settle };

/**
 * `@evinvest/sites-tools/testing/e2e` — the section-baseline runner a brand's
 * Playwright suite calls. One baseline per section at both designed
 * breakpoints; every section reached by its own URL (a `#` the site itself
 * links to), never by scrolling to it — a scroll is a moving target the runner
 * would have to guess is over. The same pages, settled the same way, also go
 * to Figma on request (`@evinvest/figma-render`'s `defineFigmaSuite`).
 *
 * Types only from `@playwright/test`: the brand passes its own `test` and
 * `expect`, so this module loads nothing at run time and cannot end up with a
 * second copy of the runner (Playwright refuses to run with two).
 */

export interface Section extends FigmaSection {
  /** `md:hidden` in the design: shot only in the `mobile` project. */
  mobileOnly?: boolean;
  /** Shot without the section stylesheet (the call bar hides itself in it). */
  bare?: boolean;
}

/** The two designed breakpoints, as Playwright projects. */
export const BREAKPOINTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "mobile", viewport: { width: 390, height: 844 } },
] as const;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- the runner's fixture types are the brand's; only `page` is read
type AnyTest = TestType<any, any>;

/** The brand's own runner: `import { test, expect } from "@playwright/test"`. */
export interface Runner {
  test: AnyTest;
  expect: Expect;
}

/** One `test` per section, each a `toHaveScreenshot` of the settled section, and the `@figma` frames of their pages. */
export function defineSectionSuite({ test, expect }: Runner, sections: readonly Section[]): void {
  defineFigmaSuite({ test }, sections);

  // The site scrolls smoothly for everyone who has not asked it not to;
  // `use.reducedMotion` does not reach the page, `emulateMedia` does.
  test.beforeEach(async ({ page }: { page: Page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  for (const section of sections) {
    test(`section: ${section.name}`, async ({ page }: { page: Page }, info: { project: { name: string } }) => {
      test.skip(Boolean(section.mobileOnly) && info.project.name !== "mobile");
      await page.goto(section.url);
      const locator = page.locator(section.selector);
      await expect(locator).toBeVisible();
      await settle(page, section.selector);
      await expect(locator).toHaveScreenshot(`${section.name}-${info.project.name}.png`, section.bare ? { stylePath: [] } : {});
    });
  }
}
