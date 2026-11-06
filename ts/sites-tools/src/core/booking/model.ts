import { isPageProvider, type BookingConfig, type PageProvider } from "@evinvest/sites-contract";

/**
 * Booking, the site's half: which of a place's providers a visitor is offered.
 * The providers, a place's config and its rules are the panel's
 * (`@evinvest/sites-contract`):
 *
 * - `manual`: no external page — the site promises a call to set the slot, and
 *   the operator records it in the panel. Always available; carries no URL.
 * - `link`: any external booking page (strict https), opened with
 *   `ref=<leadRef>` in its query.
 * - `google_calendar`: a Google appointment schedule, opened as is — it takes
 *   no parameter, so the panel matches its bookings by contact and time.
 * - `cal_com`: a Cal.com event, opened with the name, the phone and
 *   `metadata[ref]=<leadRef>` prefilled.
 */

/** The booking one page offers: the provider chosen for this visitor, and its page. */
export type BookingChoice = { provider: "manual" } | { provider: PageProvider; url: string };

/**
 * A choice a brand's own adapter makes sense of — what `LeadBooking` takes.
 * Every `BookingChoice` is one; the closed set is what the place settings
 * and `booking.requested@1` accept.
 */
export interface OpenBookingConfig {
  provider: string;
  url?: string;
}

/** A place with no booking of its own — baked or live — promises a call. */
export const DEFAULT_BOOKING: BookingConfig = { default: "manual", providers: {} };

/** The experiment whose variant names the provider a visitor is offered, the same key on every brand. */
export const BOOKING_EXPERIMENT = "booking_provider";

/**
 * The one entry point for which booking a visitor is offered: the provider
 * the experiment's variant (`booking_provider`) names, when the place has it
 * (`manual` it always has), else the place's default. The chosen provider is
 * what `booking.requested@1` and `lead_booking_open/done` report, so the arms
 * compare.
 */
export function bookingOf(place: { booking?: BookingConfig | undefined }, variant?: string | null): BookingChoice {
  const booking = place.booking ?? DEFAULT_BOOKING;
  const pick = (provider: unknown): BookingChoice | null => {
    if (provider === "manual") return { provider };
    if (!isPageProvider(provider)) return null;
    const page = booking.providers[provider];
    return page ? { provider, url: page.url } : null;
  };
  return pick(variant) ?? pick(booking.default) ?? { provider: "manual" };
}
