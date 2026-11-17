import { bookingRequested, isPageProvider, preferredDateInWindow, type BookingConfig, type PageProvider } from "@evinvest/sites-contract";
import type { SlotPreference } from "../lead";

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

/** The fields a slot preference is posted under, with the lead (`slot` in the steps) or alone (`manual`, after it). */
export const PREFERRED_DATE_FIELD = "preferred_date";
export const PREFERRED_PART_FIELD = "preferred_part";

/**
 * The slot preference a lead was posted with, held to `booking.requested@1`'s
 * own rules (a real day in the panel's window from `today`, a part of the day
 * it knows): `undefined` when none was posted, `null` when what was posted is
 * not one — a stale or forged page.
 */
export function postedPreference(read: (name: string) => string | null, today: string): SlotPreference | null | undefined {
  const date = read(PREFERRED_DATE_FIELD) || undefined;
  const part = read(PREFERRED_PART_FIELD) || undefined;
  if (date === undefined && part === undefined) return undefined;
  // The contract's check of the event's properties; the lead's ref, which it needs, is not minted before the insert.
  const checked = bookingRequested({ lead_ref: "lead-1-00000000", provider: "manual", ...(date !== undefined ? { preferred_date: date } : {}), ...(part !== undefined ? { preferred_part: part } : {}) });
  if (!checked || (checked.preferred_date !== undefined && !preferredDateInWindow(checked.preferred_date, today))) return null;
  return { ...(checked.preferred_date !== undefined ? { date: checked.preferred_date } : {}), ...(checked.preferred_part !== undefined ? { part: checked.preferred_part } : {}) };
}
