import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BOOKING_EXPERIMENT, bookingHref, bookingOf, checkBookingConfig, DEFAULT_BOOKING, type BookingChoice, type BookingConfig, type BookingPrefill } from "../src/index";

/** Which booking a visitor is offered, and the page a click opens (`fixtures/booking/README.md`). */
const read = (path: string): unknown => JSON.parse(readFileSync(join(import.meta.dirname, "fixtures/booking", path), "utf8"));

interface HrefCase {
  name: string;
  choice: BookingChoice;
  prefill: BookingPrefill;
  href: string | null;
}

describe("bookingHref against hrefs.json", () => {
  const cases = read("hrefs.json") as HrefCase[];
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    if (c.choice.provider !== "manual") expect(checkBookingConfig({ default: c.choice.provider, providers: { [c.choice.provider]: { url: c.choice.url } } }).problems).toEqual([]);
    expect(bookingHref(c.choice, c.prefill)).toBe(c.href);
  });

  it("never puts the reference in a fragment", () => {
    for (const c of cases) if (c.href) expect(new URL(c.href).hash).toBe("");
  });
});

interface ChooseCase {
  name: string;
  booking: BookingConfig | null;
  variant: string | null;
  choice: BookingChoice;
}

describe("bookingOf against choose.json: the booking_provider experiment picks among the place's providers", () => {
  const cases = read("choose.json") as ChooseCase[];
  it.each(cases.map(c => [c.name, c] as const))("%s", (_, c) => {
    if (c.booking) expect(checkBookingConfig(c.booking).problems).toEqual([]);
    expect(bookingOf(c.booking ? { booking: c.booking } : {}, c.variant)).toEqual(c.choice);
  });

  it("takes no inherited name for a provider", () => {
    expect(bookingOf({}, "toString")).toEqual({ provider: "manual" });
    expect(DEFAULT_BOOKING).toEqual({ default: "manual", providers: {} });
    expect(BOOKING_EXPERIMENT).toBe("booking_provider");
  });
});
