// Date maths for every calendar in the product (ADR-0014).
//
// The organization's timezone is the source of truth for what "a day"
// means, never the browser's. A gym in Montevideo has a 09:00 class at
// 09:00 Montevideo whether the person looking at the screen is in
// Montevideo, Madrid or on a plane.

export type CalendarView = "day" | "week" | "workweek" | "month";

export const CALENDAR_VIEWS: { value: CalendarView; label: string }[] = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "workweek", label: "Semana laboral" },
  { value: "month", label: "Mes" },
];

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const WEEKDAY_LETTER = ["D", "L", "M", "X", "J", "V", "S"];
export const WEEKDAY_LONG = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

/** "YYYY-MM-DD" for an instant, as counted in the given timezone. */
export function localDayKey(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Minutes since local midnight, used to place a block on the hour grid. */
export function minutesIntoDay(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function weekdayOf(dayKey: string): number {
  // Noon UTC so the date never slips a day from a timezone offset.
  return new Date(`${dayKey}T12:00:00Z`).getUTCDay();
}

/** Adds days to a "YYYY-MM-DD" key, staying in date-land. */
export function addDays(dayKey: string, days: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMonths(dayKey: string, months: number): string {
  const d = new Date(`${dayKey}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing dayKey. */
export function startOfWeek(dayKey: string): string {
  const weekday = weekdayOf(dayKey);
  // Sunday (0) belongs to the week that started the Monday before it.
  return addDays(dayKey, weekday === 0 ? -6 : 1 - weekday);
}

export function startOfMonth(dayKey: string): string {
  return `${dayKey.slice(0, 7)}-01`;
}

/** Today in the organization's timezone, not the browser's. */
export function todayKey(timeZone: string): string {
  return localDayKey(new Date(), timeZone);
}

export interface CalendarRange {
  /** Inclusive first day shown. */
  from: string;
  /** Inclusive last day shown. */
  to: string;
  /** Every day the view renders, in order. */
  days: string[];
}

/**
 * The days a view covers, anchored on one date.
 *
 * Month view intentionally spans whole weeks so the grid is rectangular:
 * a month starting on a Thursday still renders a full first row.
 */
export function rangeFor(view: CalendarView, anchor: string): CalendarRange {
  if (view === "day") {
    return { from: anchor, to: anchor, days: [anchor] };
  }

  if (view === "week" || view === "workweek") {
    const monday = startOfWeek(anchor);
    const length = view === "workweek" ? 5 : 7;
    const days = Array.from({ length }, (_, i) => addDays(monday, i));
    return { from: days[0]!, to: days[days.length - 1]!, days };
  }

  const first = startOfMonth(anchor);
  const gridStart = startOfWeek(first);
  const lastOfMonth = addDays(addMonths(first, 1), -1);
  const gridEnd = addDays(startOfWeek(lastOfMonth), 6);

  const days: string[] = [];
  for (let day = gridStart; day <= gridEnd; day = addDays(day, 1)) {
    days.push(day);
  }
  return { from: gridStart, to: gridEnd, days };
}

/** Step one unit forward or back in the current view. */
export function shiftAnchor(view: CalendarView, anchor: string, direction: 1 | -1): string {
  if (view === "day") return addDays(anchor, direction);
  if (view === "month") return addMonths(anchor, direction);
  return addDays(anchor, 7 * direction);
}

/** The UTC instants bounding a range of local days, for querying. */
export function rangeInstants(range: CalendarRange, timeZone: string): { from: Date; to: Date } {
  // Widened by a day on each side and filtered precisely afterwards:
  // computing an exact local midnight in an arbitrary timezone needs more
  // machinery than it saves, and over-fetching one day is free here.
  void timeZone;
  return {
    from: new Date(`${addDays(range.from, -1)}T00:00:00Z`),
    to: new Date(`${addDays(range.to, 1)}T23:59:59Z`),
  };
}

export function isToday(dayKey: string, timeZone: string): boolean {
  return dayKey === todayKey(timeZone);
}

export function isSameMonth(dayKey: string, anchor: string): boolean {
  return dayKey.slice(0, 7) === anchor.slice(0, 7);
}

/** "lunes 21 de septiembre", for the toolbar. */
export function formatDayLong(dayKey: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

export function formatMonthLong(dayKey: string): string {
  return new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

export function formatRangeLabel(view: CalendarView, range: CalendarRange): string {
  if (view === "day") return formatDayLong(range.from);
  if (view === "month") return formatMonthLong(range.days[15] ?? range.from);

  const fmt = (key: string) =>
    new Intl.DateTimeFormat("es-UY", { timeZone: "UTC", day: "numeric", month: "short" }).format(
      new Date(`${key}T12:00:00Z`),
    );
  return `${fmt(range.from)} – ${fmt(range.to)}`;
}

/** The hour rows a day/week grid renders, bounded by what is scheduled. */
export function hourBounds(minutes: number[]): { startHour: number; endHour: number } {
  if (minutes.length === 0) return { startHour: 7, endHour: 22 };
  const min = Math.min(...minutes);
  const max = Math.max(...minutes);
  return {
    startHour: Math.max(0, Math.floor(min / 60) - 1),
    endHour: Math.min(24, Math.ceil(max / 60) + 1),
  };
}
