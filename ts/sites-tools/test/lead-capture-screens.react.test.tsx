import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LEAD_CAPTURE_TEXT, leadErrorOf, type OpeningHours, type Place } from "../src/index";
import { Faq, LeadCapture, type LeadCaptureProps, type LeadIntro, type LeadScreen } from "../src/react/index";
import { serviceAreaPlace } from "../src/testing/index";
import { MODEL } from "./support/fixtures";

// `screens`: the questions of `layout="steps"` as a brand groups them, and the
// slot asked among them — the card a booking brand draws (debouchage's
// BookingCard): the job and when on one screen, the slot when a time was
// chosen, then who and where, the price on the submit.

const WEEKDAYS: readonly OpeningHours[] = [{ days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "19:00" }];
// Monday 5 October 2026, 10:00 in Paris.
const MONDAY_10H = new Date("2026-10-05T08:00:00Z").getTime();
const NEEDS = [
  { value: "standard", label: "Ménage courant" },
  { value: "windows", label: "Vitres", hint: "Toutes les vitres" },
  { value: "deep", label: "Grand ménage" },
];
const FLOWS = { standard: "estimate", windows: "fixed", deep: "quote" } as const;
// One commune: a postcode form would fill it in; an address form must not.
const place: Place<"fr" | "en"> = serviceAreaPlace(["fr", "en"], { hours: WEEKDAYS, serviceArea: [{ kind: "localities", names: ["Royat"] }] });
const fr = LEAD_CAPTURE_TEXT.fr;

const WHEN: LeadIntro = {
  label: "Quand ?",
  field: "when",
  options: [
    { value: "asap", label: "Au plus vite", hint: "env. 45 min" },
    { value: "today", label: "Aujourd’hui", hint: "heure au choix", slot: "today" },
    { value: "later", label: "Autre jour", hint: "jour au choix", slot: "later" },
  ],
};
const SCREENS: readonly LeadScreen[] = [
  { ask: ["need", "intro"], head: <h2>Réservez</h2> },
  { ask: ["slot"], head: <h2>Votre créneau</h2> },
  { ask: ["name", "phone", "locality"], head: <h2>Où et qui ?</h2> },
];

function card(over: Partial<LeadCaptureProps> = {}): ReactElement {
  return (
    <LeadCapture
      place={place}
      contact={{ phone: null, whatsapp: null }}
      locale="fr"
      renderedAt={MONDAY_10H}
      wire={{ subject: "job", locality: "zip", mobile: "mobile" }}
      needs={NEEDS}
      flows={FLOWS}
      pricing={MODEL}
      text={{ ...fr, bookSubmitPrice: "Réserver · prix fixe {price}" }}
      layout="steps"
      needDisplay="cards"
      intro={WHEN}
      screens={SCREENS}
      name={{ field: "first_name" }}
      locality={{ ask: "address" }}
      {...over}
    />
  );
}

const form = () => {
  const el = document.getElementById("quote-form");
  if (!(el instanceof HTMLFormElement)) throw new Error("no form");
  return el;
};
const posted = () => Object.fromEntries(new FormData(form()));
const shown = () => [...form().querySelectorAll<HTMLElement>("[data-lead-step]")].filter(s => !s.hasAttribute("data-lead-off") && s.style.display !== "none").map(s => s.dataset["leadStep"]);
const radio = (name: string, value: string) => {
  const el = form().querySelector(`input[type=radio][name="${name}"][value="${value}"]`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no radio ${name}=${value}`);
  return el;
};
const field = (name: string) => {
  const el = form().querySelector(`input[name="${name}"]:not([type=radio])`);
  if (!(el instanceof HTMLInputElement)) throw new Error(`no field ${name}`);
  return el;
};
const tap = (el: HTMLInputElement) => {
  fireEvent.pointerDown(el);
  fireEvent.click(el, { detail: 1 });
};
const next = () => fireEvent.click(within(form()).getByRole("button", { name: fr.stepNext ?? "" }));
const heading = () => screen.getByRole("heading").textContent;

/** The first screen answered with a fixed need and `when`, then on. */
function through(when: string) {
  tap(radio("job", "windows"));
  tap(radio("when", when));
  next();
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MONDAY_10H);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  vi.useRealTimers();
  vi.unstubAllGlobals();
  window.history.replaceState(null, "", "/");
});

describe("screens of several questions", () => {
  it("asks the need and the intro on one screen, its tiles priced and hinted, and moves on by its button only", () => {
    render(card());
    expect(shown()).toEqual(["need"]);
    expect(heading()).toBe("Réservez");
    // A fixed need's price is the price list's, on its tile; an estimate's has none to say.
    expect(radio("job", "windows").nextElementSibling).toHaveTextContent(/Vitres\s*Toutes les vitres\s*89\s€/);
    expect(radio("job", "standard").nextElementSibling).not.toHaveTextContent("€");
    expect(radio("when", "asap").nextElementSibling).toHaveTextContent("Au plus vite" + "env. 45 min");
    tap(radio("job", "windows"));
    expect(shown()).toEqual(["need"]);
    // The intro unanswered: the button says so, and stays.
    next();
    expect(shown()).toEqual(["need"]);
    expect(radio("when", "asap").validationMessage).toBe(fr.required);
    tap(radio("when", "asap"));
    expect(shown()).toEqual(["need"]);
    next();
    // « Au plus vite » asks no slot: who and where, in the brand's order.
    expect(shown()).toEqual(["phone"]);
    expect(heading()).toBe("Où et qui ?");
    const order = [...form().querySelectorAll("[data-lead-step=phone] [data-lead-field]")].map(el => el.getAttribute("data-lead-field"));
    expect(order).toEqual(["name", "phone", "locality"]);
    expect(within(form()).getByRole("button", { name: /Réserver · prix fixe 89\s€/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Votre besoin · Quand \?, Vitres · Au plus vite/ })).toBeTruthy();
  });

  it("asks a street address: the address autofill, letters, and nothing filled in for it", () => {
    window.history.replaceState(null, "", "/fr?postcode=63130");
    render(card());
    const zip = field("zip");
    expect(zip).toHaveAttribute("autocomplete", "street-address");
    expect(zip).toHaveAttribute("inputmode", "text");
    expect(zip.value).toBe("");
    expect(form().querySelector("[role=group] button")).toBeNull();
  });

  it("opens the screen of the intro's field when the server refused it", () => {
    document.body.innerHTML = renderToString(card({ initialError: leadErrorOf({ lead_error: "when" }) }));
    expect(shown()).toEqual(["need"]);
  });

  it("refuses screens it cannot draw: a question twice, the phone's screen with another question", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() => render(card({ screens: [{ ask: ["need"] }, { ask: ["need", "intro"] }] }))).toThrow(/"need" is on two of the screens/);
    expect(() => render(card({ screens: [{ ask: ["need", "phone"] }] }))).toThrow(/holds only locality, name, phone/);
  });
});

describe("the slot, asked on the steps", () => {
  it("today: the day is today, chosen; its part is asked before the contact, posted with the lead", () => {
    render(card());
    through("today");
    expect(shown()).toEqual(["slot"]);
    expect(heading()).toBe("Votre créneau");
    expect(radio("preferred_date", "2026-10-05")).toBeChecked();
    expect(radio("preferred_date", "2026-10-05").nextElementSibling).toHaveTextContent("Aujourd’hui");
    next();
    expect(shown()).toEqual(["slot"]);
    tap(radio("preferred_part", "afternoon"));
    expect(shown()).toEqual(["slot"]);
    next();
    expect(shown()).toEqual(["phone"]);
    expect(posted()).toMatchObject({ when: "today", preferred_date: "2026-10-05", preferred_part: "afternoon" });
    expect(screen.getByRole("button", { name: /lun\. 5 · Après-midi/ })).toBeTruthy();
  });

  it("later: the days start tomorrow, none chosen; another answer takes the slot away", () => {
    render(card());
    through("later");
    expect(form().querySelectorAll("input[name=preferred_date]:checked")).toHaveLength(0);
    expect(radio("preferred_date", "2026-10-06").nextElementSibling).toHaveTextContent("Demain");
    expect(form().querySelector("input[name=preferred_date][value='2026-10-05']")).toBeNull();
    tap(radio("preferred_date", "2026-10-08"));
    tap(radio("preferred_part", "morning"));
    next();
    expect(shown()).toEqual(["phone"]);
    fireEvent.click(screen.getByRole("button", { name: /Votre besoin · Quand \?/ }));
    tap(radio("when", "asap"));
    next();
    expect(shown()).toEqual(["phone"]);
    expect(posted()).not.toHaveProperty("preferred_date");
    expect(posted()).not.toHaveProperty("preferred_part");
  });

  it("is not asked for a need the price list does not price, nor when the visitor's booking is a provider's page", () => {
    render(card());
    tap(radio("job", "deep"));
    tap(radio("when", "today"));
    next();
    expect(shown()).toEqual(["phone"]);
    cleanup();
    render(card({ place: { ...place, booking: { default: "cal_com", providers: { cal_com: { url: "https://cal.com/brand/vitres" } } } } }));
    through("today");
    expect(shown()).toEqual(["phone"]);
  });

  it("hydrates the days the server drew, in the place's calendar", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const container = document.createElement("div");
    container.innerHTML = renderToString(card());
    document.body.append(container);
    const root = await act(async () => hydrateRoot(container, card()));
    expect(errors).not.toHaveBeenCalled();
    // 10:00 in Paris on Monday 5 October: today is the 5th wherever the browser is.
    expect(form().querySelector("input[name=preferred_date]")).toHaveAttribute("value", "2026-10-05");
    act(() => root.unmount());
  });

  it("is in the form without a script, every screen at once, nothing of it required", () => {
    document.body.innerHTML = renderToString(card());
    expect([...form().querySelectorAll<HTMLElement>("[data-lead-step]")].map(s => s.dataset["leadStep"])).toEqual(["need", "slot", "phone"]);
    expect(form().querySelectorAll("input[name=preferred_date]")).toHaveLength(7);
    expect(form().querySelector("input[name=preferred_part][required], input[name=preferred_date][required]")).toBeNull();
  });
});

describe("after a lead whose steps asked the slot", () => {
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  async function book(answer: Record<string, unknown>, over: Partial<LeadCaptureProps> = {}) {
    vi.stubGlobal("fetch", vi.fn(async () => json({ ok: true, location: "/fr/thanks", lead: "lead-12-0a1b2c3d", cents: 8900, ...answer })));
    render(card(over));
    through("today");
    tap(radio("preferred_part", "afternoon"));
    next();
    fireEvent.change(field("first_name"), { target: { value: "Sophie" } });
    fireEvent.change(field("mobile"), { target: { value: "06 12 34 56 78" } });
    fireEvent.change(field("zip"), { target: { value: "12 rue Blatin, Clermont-Ferrand" } });
    await act(async () => {
      fireEvent.submit(form());
      await Promise.resolve();
    });
    return screen.getByRole("status");
  }

  it("acknowledges the slot the server kept, and asks for none again", async () => {
    const done = await book({ slot: { date: "2026-10-05", part: "afternoon" } });
    expect(done).toHaveTextContent(fr.preferSent ?? "");
    expect(within(done).queryByRole("radio")).toBeNull();
  });

  it("promises the call, not a preference noted, when the server kept none", async () => {
    const done = await book({});
    expect(done).toHaveTextContent(fr.slotCallback ?? "");
    expect(done).not.toHaveTextContent(fr.preferSent ?? "");
  });

  it("hands the brand what was posted, and the kit's booking to keep or drop", async () => {
    const seen: { fields: Readonly<Record<string, string>>; kit: boolean }[] = [];
    const done = await book(
      { slot: { date: "2026-10-05", part: "afternoon" } },
      {
        done: sent => <p>{`Réservé, ${sent.fields["first_name"] ?? ""} : ${sent.fields["job"] ?? ""}, ${sent.fields["when"] ?? ""}`}</p>,
        booking: (sent, kit) => (seen.push({ fields: sent.fields, kit: kit !== null }), null),
      },
    );
    expect(done).toHaveTextContent("Réservé, Sophie : windows, today");
    expect(done).not.toHaveTextContent(fr.preferSent ?? "");
    expect(done).not.toHaveTextContent(fr.slotCallback ?? "");
    expect(seen.at(-1)).toMatchObject({ kit: true, fields: { when: "today", preferred_date: "2026-10-05", preferred_part: "afternoon" } });
  });
});

describe("Faq", () => {
  it("draws the item it is told open, the others closed", () => {
    render(<Faq items={[{ q: "Un ?", a: "Oui." }, { q: "Deux ?", a: "Non." }]} open={0} />);
    expect([...document.querySelectorAll("details")].map(d => d.open)).toEqual([true, false]);
  });
});
