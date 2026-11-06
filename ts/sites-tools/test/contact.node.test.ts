import { describe, expect, it } from "vitest";

import { contactChannel, telHref, whatsappHref, type ContactChannel } from "../src/core/contact";

const CHANNEL: [string, ContactChannel | null][] = [
  ["tel:+33 1 23", "phone"],
  ["TEL:+331", "phone"],
  ["  tel:+331", "phone"],
  ["mailto:a@b.c", "email"],
  ["https://wa.me/33612345678", "whatsapp"],
  ["http://wa.me/336", "whatsapp"],
  ["https://api.whatsapp.com/send?phone=336", "whatsapp"],
  ["https://web.whatsapp.com/send?phone=336", "whatsapp"],
  ["whatsapp://send?phone=336", "whatsapp"],
  ["https://WA.ME/336", "whatsapp"],
  ["https://u@wa.me:443/336", "whatsapp"],
  ["https://wa%2Eme/33423500640", "whatsapp"],
  ["https://wa.me\\33423500640", "whatsapp"],
  ["https://wa.me.evil.com/336", null],
  ["https://evil.com/wa.me", null],
  ["https://example.com/tel:+331", null],
  ["/contact", null],
  ["", null],
];

const TEL: [string, string][] = [
  ["+33 (0)1 23-45.67 89", "tel:+33123456789"],
  ["04 23 50 06 40", "tel:0423500640"],
  ["+33 (0)4 23 50 06 40", "tel:+33423500640"],
];

const WHATSAPP: [string, string | null, string][] = [
  ["+33 6 12 34 56 78", "Bonjour, fuite ?", "https://wa.me/33612345678?text=Bonjour%2C%20fuite%20%3F"],
  ["0033 6 12 34 56 78", null, "https://wa.me/33612345678"],
  ["0033 4 23 50 06 40", "Bonjour !", "https://wa.me/33423500640?text=Bonjour%20!"],
  ["+33 (0)6 12 34 56 78", "", "https://wa.me/33612345678"],
  ["06 12 34 56 78", null, "https://wa.me/0612345678"],
  ["+33612345678", "café (urgent) ~ 100%", "https://wa.me/33612345678?text=caf%C3%A9%20(urgent)%20~%20100%25"],
];

describe("contact links", () => {
  it.each(CHANNEL)("classifies %s as %s", (href, channel) => {
    expect(contactChannel(href)).toBe(channel);
  });

  it.each(TEL)("tel href of %s is %s", (phone, href) => {
    expect(telHref(phone)).toBe(href);
  });

  it.each(WHATSAPP)("wa.me href of %s with %s is %s", (phone, message, href) => {
    expect(whatsappHref(phone, message ?? undefined)).toBe(href);
  });
});
