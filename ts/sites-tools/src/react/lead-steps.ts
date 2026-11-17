"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LeadStep } from "../core/analytics";
import { estimateField } from "../core/pricing/flow";

/** One answer to the intro question. */
export interface LeadIntroOption {
  /** Posted under the intro's `field`: a slug. */
  value: string;
  label: string;
  /** A line under the label ("env. 45 min"). */
  hint?: string | undefined;
  /** Drawn on its tile, the brand's own. */
  icon?: ReactNode;
  /** `callback`: the rest of the form is the phone and its consent, posted as a callback. `form` (default): the form. */
  channel?: "form" | "callback" | undefined;
  /**
   * Asks the slot the visitor prefers, on a screen of its own before the
   * contact (`slot`): `today` — a part of today, today chosen; `later` — a day
   * from tomorrow and its part. Only for a priced need and a `manual` booking;
   * posted with the lead and sent on as `booking.requested@1`.
   */
  slot?: "today" | "later" | undefined;
}

/**
 * A question whose answer goes with the lead as one of the brand's extras —
 * how urgent, who is asking: declare `field` in `site.lead.extras`, or the
 * server drops it. Its answer may change what follows (`channel`, `slot`).
 */
export interface LeadIntro {
  label: string;
  field: string;
  options: readonly LeadIntroOption[];
}

/**
 * A screen of `layout="steps"` as the brand arranges it: the questions it
 * asks, in order — `intro`, `need`, `slot`, `locality`, `name`, `phone`, or an
 * estimate input's id. A question asked now and on no screen has its own.
 */
export interface LeadScreen {
  ask: readonly string[];
  /** The card's heading while this screen is on (`head` otherwise). */
  head?: ReactNode;
  /** Its button's words, when it has one (several questions, a typed field, the slot); `text.stepNext` by default. */
  next?: string | undefined;
}

/** A screen of `layout="steps"`, named as `lead_form_step` reports it. */
export type StepId = Exclude<LeadStep, "contact">;

/** A screen as it is drawn: named by its first question (the contact's is `phone`), the questions asked now on it. */
export interface Screen {
  id: StepId;
  ask: readonly string[];
  head?: ReactNode;
  next?: string | undefined;
}

const KIT_QUESTIONS: readonly string[] = ["intro", "need", "slot", "locality", "name", "phone"];
/** What the contact's screen may hold beside the phone: it is always last, with the brand's extras and the submit. */
const CONTACT: readonly string[] = ["locality", "name", "phone"];

const stepOf = (question: string): StepId => (KIT_QUESTIONS.includes(question) ? (question as StepId) : (estimateField(question) as StepId));

/**
 * The screens, in order. `asked`: the questions asked now, in the kit's
 * order — the intro, the need, the estimate's, the slot, the postcode, the
 * phone, the name. A screen of the brand's holds those of its questions asked
 * now (none: no screen), and stands where the first of them would; any other
 * question has a screen of its own, the name the phone's. The phone's screen
 * is always last.
 */
export function screensOf(layout: readonly LeadScreen[] | undefined, asked: readonly string[]): Screen[] {
  const listed = new Set<string>();
  const screens: { id: StepId; ask: string[]; head?: ReactNode; next?: string | undefined }[] = [];
  for (const screen of layout ?? []) {
    for (const question of screen.ask) {
      if (listed.has(question)) throw new Error(`LeadCapture: "${question}" is on two of the screens`);
      listed.add(question);
    }
    if (screen.ask.includes("phone") && screen.ask.some(q => !CONTACT.includes(q))) {
      throw new Error(`LeadCapture: the phone's screen is the last and holds only ${CONTACT.join(", ")}; got ${screen.ask.join(", ")}`);
    }
    const ask = screen.ask.filter(q => asked.includes(q));
    if (ask.length === 0) continue;
    screens.push({ id: ask.includes("phone") ? "phone" : stepOf(ask[0] ?? ""), ask, ...(screen.head !== undefined ? { head: screen.head } : {}), ...(screen.next !== undefined ? { next: screen.next } : {}) });
  }
  const on = (question: string) => screens.some(s => s.ask.includes(question));
  let contact = screens.find(s => s.id === "phone");
  if (!contact) screens.push((contact = { id: "phone", ask: ["phone"] }));
  if (asked.includes("name") && !on("name")) contact.ask.push("name");
  for (const question of asked) if (!on(question)) screens.push({ id: stepOf(question), ask: [question] });
  const first = (screen: Screen) => Math.min(...screen.ask.map(q => asked.indexOf(q)));
  return [...screens.filter(s => s !== contact).sort((a, b) => first(a) - first(b)), contact];
}

/** The screen a refused field is shown on: its own question's, else the last. */
export function stepOfField(screens: readonly Screen[], field: string, introField: string | undefined): StepId | null {
  const question = field === introField ? "intro" : field;
  const own = screens.find(s => s.ask.some(q => q === question || (!KIT_QUESTIONS.includes(q) && estimateField(q) === field)));
  return (own ?? screens[screens.length - 1])?.id ?? null;
}

/**
 * Which screen is on: the one a refusal points at, else the one the visitor
 * went back to (`back`, `edit`), else the first not yet answered. An answer
 * calls `next`, and the first open screen comes back on. Each move is
 * reported once (`onStep`) — never the first screen, which `lead_form_view`
 * already counts.
 */
export function useLeadSteps(steps: readonly StepId[], answered: (id: StepId) => boolean, refused: StepId | null, onStep: (id: StepId) => void) {
  const [at, setAt] = useState<StepId | null>(null);
  const open = steps.find(s => !answered(s)) ?? steps[steps.length - 1] ?? "phone";
  const current = refused !== null && steps.includes(refused) ? refused : at !== null && steps.includes(at) ? at : open;
  const index = steps.indexOf(current);
  const shown = useRef(current);
  const report = useRef(onStep);
  report.current = onStep;
  useEffect(() => {
    if (shown.current === current) return;
    shown.current = current;
    report.current(current);
  }, [current]);
  return {
    current,
    index,
    back: () => setAt(steps[index - 1] ?? null),
    edit: (id: StepId) => setAt(id),
    next: () => setAt(null),
  };
}
