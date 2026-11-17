"use client";

import { Button, cn } from "@evinvest/uikit";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { DAY_PARTS, type DayPart } from "@evinvest/sites-contract";
import { PREFERRED_DATE_FIELD, PREFERRED_PART_FIELD } from "../core/booking/model";
import type { LeadCaptureFlowText } from "../core/lead-capture-text";
import { TileGroup, type TileOption } from "./LeadCaptureTiles";
import type { PartClassNames } from "./parts";
import type { BookingReport } from "./use-booking";

export type BookingPart = "booking" | "bookingCta" | "bookingNote" | "prefer" | "preferOption" | "preferSubmit";

/** How many days a visitor may prefer among: tiles, not a calendar — a tap each. */
const DAYS_AHEAD = 7;

/** `YYYY-MM-DD` in the visitor's own calendar, `n` days from `now`. */
function dayFrom(now: number, n: number): string {
  const d = new Date(now);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today in the visitor's own calendar, as a preferred day is posted. */
export const todayOf = (now: number): string => dayFrom(now, 0);

/**
 * The days a visitor may prefer, from `from` days after `now` (`0`: today,
 * which the contract takes): today and tomorrow by name over their weekday,
 * the others by weekday over their date.
 */
function daysOf(now: number, from: 0 | 1, locale: string, text: Pick<LeadCaptureFlowText, "slotToday" | "slotTomorrow">): TileOption[] {
  const weekday = new Intl.DateTimeFormat(locale, { weekday: "short" });
  const weekdayDay = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric" });
  const dayMonth = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" });
  const upper = (s: string) => s.charAt(0).toLocaleUpperCase(locale) + s.slice(1);
  return Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const n = from + i;
    const value = dayFrom(now, n);
    const noon = new Date(`${value}T12:00:00`);
    const named = n === 0 ? text.slotToday : n === 1 ? text.slotTomorrow : null;
    return named !== null ? { value, label: named, hint: weekdayDay.format(noon) } : { value, label: upper(weekday.format(noon)), hint: dayMonth.format(noon) };
  });
}

/**
 * The slot a visitor prefers: a day (from `from`) and a part of the day, a
 * tap each, posted as `preferred_date` and `preferred_part` — with the lead,
 * on its steps, or alone after it (`manual`).
 */
export function SlotField(props: {
  now: number;
  from: 0 | 1;
  locale: string;
  text: LeadCaptureFlowText;
  day: string | undefined;
  part: DayPart | undefined;
  /** Without the day row: the day is known (posted by the caller). */
  dayAsked: boolean;
  required: boolean;
  /** Enter on a tile answers it, rather than submitting the form. */
  enterPicks: boolean;
  onDay: (day: string, radio: HTMLInputElement | null) => void;
  onPart: (part: DayPart, radio: HTMLInputElement | null) => void;
  classNames?: PartClassNames<BookingPart | "label" | "optionHint"> | undefined;
}) {
  const { text, classNames: c } = props;
  const { slotToday, slotTomorrow } = text;
  const days = useMemo(() => daysOf(props.now, props.from, props.locale, { slotToday, slotTomorrow }), [props.now, props.from, props.locale, slotToday, slotTomorrow]);
  const parts = DAY_PARTS.map(value => ({ value, label: { morning: text.partMorning, afternoon: text.partAfternoon, evening: text.partEvening }[value] }));
  const tiles = { legend: cn("mb-2 text-sm font-medium text-ink", c?.label), grid: "grid grid-cols-3 gap-2 sm:grid-cols-4", tile: cn("h-full justify-center px-2 py-2 text-center text-sm", c?.preferOption), hint: c?.optionHint };
  const asPart = (v: string) => DAY_PARTS.find(p => p === v);
  return (
    <>
      {props.dayAsked && (
        <TileGroup
          name={PREFERRED_DATE_FIELD}
          legend={text.preferDay}
          options={days}
          value={props.day}
          required={props.required}
          field={PREFERRED_DATE_FIELD}
          enterPicks={props.enterPicks}
          onPick={(v, radio) => props.onDay(v, radio)}
          onSelect={v => props.onDay(v, null)}
          classNames={tiles}
        />
      )}
      <TileGroup
        name={PREFERRED_PART_FIELD}
        legend={text.preferPart}
        options={parts}
        value={props.part}
        required={props.required}
        field={PREFERRED_PART_FIELD}
        enterPicks={props.enterPicks}
        onPick={(v, radio) => {
          const part = asPart(v);
          if (part) props.onPart(part, radio);
        }}
        onSelect={v => {
          const part = asPart(v);
          if (part) props.onPart(part, null);
        }}
        classNames={tiles}
      />
    </>
  );
}

/**
 * `manual`: the call is promised, and the visitor may say when suits them —
 * a day of the coming week (from today) and a part of the day, both
 * optional, no free text. Sent as `booking.requested@1`; the operator sets
 * the slot on the call.
 */
export function LeadBookingManual(props: { leadRef: string; locale: string; now: number; text: LeadCaptureFlowText; report: BookingReport | null; classNames?: PartClassNames<BookingPart | "label" | "optionHint"> | undefined }) {
  const { text, classNames: c } = props;
  const [day, setDay] = useState<string | undefined>(undefined);
  const [part, setPart] = useState<DayPart | undefined>(undefined);
  const [state, setState] = useState<"idle" | "busy" | "sent" | "failed">("idle");
  const report = props.report;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!report || (day === undefined && part === undefined)) return;
    setState("busy");
    const ok = await report.requested({ lead_ref: props.leadRef, provider: "manual", ...(day ? { preferred_date: day } : {}), ...(part ? { preferred_part: part } : {}) });
    setState(ok ? "sent" : "failed");
  };

  let body: ReactNode = null;
  if (state === "sent") body = <p className="text-ink">{text.preferSent}</p>;
  else if (report)
    body = (
      <form onSubmit={send} className={cn("flex flex-col gap-4", c?.prefer)} data-booking-prefer="">
        <p className="text-sm text-ink-soft">{text.preferTitle}</p>
        <SlotField
          now={props.now}
          from={0}
          locale={props.locale}
          text={text}
          day={day}
          part={part}
          dayAsked
          required={false}
          enterPicks={false}
          onDay={setDay}
          onPart={setPart}
          classNames={c}
        />
        {state === "failed" && (
          <p role="alert" className="text-sm text-ink">
            {text.preferFailed}
          </p>
        )}
        <Button type="submit" variant="outline" size="touch" disabled={state === "busy" || (day === undefined && part === undefined)} className={cn("w-full", c?.preferSubmit)}>
          {text.preferSubmit}
        </Button>
      </form>
    );
  return (
    <div className={cn("flex flex-col gap-4", c?.booking)}>
      <p className={cn("text-ink", c?.bookingNote)}>{text.slotCallback}</p>
      {body}
    </div>
  );
}
