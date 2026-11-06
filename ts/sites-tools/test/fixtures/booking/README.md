# Booking fixtures — the site's half

What a visitor is offered and the page a click opens; the config, its URL rule
and `booking.requested@1` are the panel's (`@evinvest/sites-contract`, held to
sites_panel's `contracts/vectors/booking`).

- `choose.json` — `[{ name, booking, variant, choice }]`: which booking a
  visitor is offered for a variant of the `booking_provider` experiment.
- `hrefs.json` — `[{ name, choice, prefill, href }]`: the page a click opens,
  byte for byte; `href: null` opens nothing.

## The choice (normative)

The `booking_provider` experiment's variant (the same key on every brand)
names the provider a visitor is offered: `manual` always, another provider
when the place has it in `providers`. Any other variant, or none, is the
place's `default`. No booking at all is `manual`. The chosen provider is the
`provider` of `booking.requested@1` and of the site's `lead_booking_open` /
`lead_booking_done` events.

## The link (normative)

The lead's reference (`leadRef`, `lead-<row>-<8 hex>`, the panel's lead id),
when a provider takes it, goes in the QUERY, never in the fragment. Each pair
the site adds replaces a pair of the same (decoded) key already in the query;
every other pair is kept byte for byte, in order, and the added pairs come
last, in the order below. Keys are written as is, values percent-encoded
(`encodeURIComponent`).

- `manual` — no link.
- `link` — `ref=<leadRef>`. Nothing else: an arbitrary host gets no personal
  data.
- `google_calendar` — the URL as is: a schedule takes no parameter. The panel
  matches its bookings by the contact (the visitor is asked to type the same
  phone) and the time window.
- `cal_com` — `name=<name>` when a non-blank name was given (trimmed);
  `attendeePhoneNumber=<E.164>` when the typed number reads as one;
  `metadata[ref]=<leadRef>`.
