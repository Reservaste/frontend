/**
 * ADR-0031: words for long billing periods (a quarter, a semester, a year).
 *
 * Presentation only. What a payment actually covers is `billing_period_for()`
 * and what it should cost is `quote_service_plan_period()`, both in SQL; this
 * module never computes a period or a price for a real payment. It exists
 * for two things the database has no read for:
 *
 * 1. the plan form's preview of the blocks an anchor month produces, *before*
 *    saving (ADR-0031 riesgo 2: a wrong anchor misaligns every customer of
 *    the plan and is immutable afterwards), and
 * 2. turning the period the server already resolved into "trimestre jul–sep".
 */

const MONTH_SHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/**
 * Block lengths a fixed-calendar cycle accepts: they have to divide the year
 * (`service_plans_billing_period_months_range`). A rolling cycle takes any
 * 1..12, but offering the same list keeps the choice readable.
 */
export const CALENDAR_PERIOD_MONTHS = [1, 2, 3, 4, 6, 12] as const;

/** "trimestre", "semestre"… -- falls back to "período de N meses". */
export function periodNoun(months: number): string {
  switch (months) {
    case 1:
      return "mes";
    case 2:
      return "bimestre";
    case 3:
      return "trimestre";
    case 4:
      return "cuatrimestre";
    case 6:
      return "semestre";
    case 12:
      return "año";
    default:
      return `período de ${months} meses`;
  }
}

/** "Cada 3 meses (trimestral)". */
export function periodChoiceLabel(months: number): string {
  if (months === 1) return "Todos los meses";
  const adjective: Record<number, string> = {
    2: "bimestral",
    3: "trimestral",
    4: "cuatrimestral",
    6: "semestral",
    12: "anual",
  };
  return adjective[months] ? `Cada ${months} meses (${adjective[months]})` : `Cada ${months} meses`;
}

/**
 * The blocks a fixed-calendar cycle produces over one year, starting at the
 * anchor: (3, 1) → ["ene–mar", "abr–jun", "jul–sep", "oct–dic"];
 * (6, 3) → ["mar–ago", "sep–feb"].
 */
export function calendarBlocks(months: number, anchorMonth: number): string[] {
  if (months < 1 || 12 % months !== 0 || anchorMonth < 1 || anchorMonth > 12) return [];

  const blocks: string[] = [];
  for (let i = 0; i < 12 / months; i += 1) {
    const start = (anchorMonth - 1 + i * months) % 12;
    const end = (start + months - 1) % 12;
    blocks.push(months === 1 ? MONTH_SHORT[start] : `${MONTH_SHORT[start]}–${MONTH_SHORT[end]}`);
  }
  return blocks;
}

/**
 * A resolved period, from `periodStart`/`periodEnd` (ISO dates, as the
 * server returns them): "jul–sep 2026", "nov 2026–ene 2027", "sep 2026".
 * Parsed as plain dates -- no timezone can shift a month boundary here.
 */
export function formatPeriodRange(periodStart: string, periodEnd: string): string {
  const [sy, sm] = periodStart.split("-").map(Number);
  const [ey, em] = periodEnd.split("-").map(Number);
  if (!sy || !sm || !ey || !em) return `${periodStart} → ${periodEnd}`;

  const start = MONTH_SHORT[sm - 1];
  const end = MONTH_SHORT[em - 1];
  if (sy === ey && sm === em) return `${start} ${sy}`;
  if (sy === ey) return `${start}–${end} ${sy}`;
  return `${start} ${sy}–${end} ${ey}`;
}

/** Whether two ISO date ranges (inclusive) overlap. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export interface PlanQuote {
  price: number;
  proratedPrice: number;
  prorated: boolean;
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * Which of the server's two prices the payment form should prefill.
 *
 * The prorated one only for a first sign-up mid-cycle. When the customer
 * already has a live payment in that period, this is a plan change, and a
 * plan change is VOID + re-charge the *whole* period (ADR-0024 resolution 1,
 * ADR-0031 resolution 3) -- `quote_service_plan_period()` cannot tell the
 * two apart, because it looks at no payment (docs/api.md, Fase 31 §3).
 *
 * Only a suggestion either way: the amount field stays editable.
 */
export function suggestedAmount(
  quote: PlanQuote,
  livePeriods: { periodStart: string; periodEnd: string }[],
): { amount: number; mode: "full" | "prorated" | "plan-change" } {
  if (!quote.prorated) return { amount: quote.price, mode: "full" };

  const covered =
    quote.periodStart !== null &&
    quote.periodEnd !== null &&
    livePeriods.some((p) => overlaps(p.periodStart, p.periodEnd, quote.periodStart!, quote.periodEnd!));

  return covered ? { amount: quote.price, mode: "plan-change" } : { amount: quote.proratedPrice, mode: "prorated" };
}
