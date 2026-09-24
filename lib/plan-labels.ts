import type { BillingCycle, BillingType, PlanQuotaScope, ServicePlanKind } from "@reservaste/domain";

/**
 * What a ServicePlan says, in words (ADR-0024).
 *
 * Plain module, not `"use server"`: read by both server and client
 * components, same reason as `booking-reasons.ts`.
 *
 * Deliberately generic wording. `DROP_IN` is "turno suelto", never "clase
 * suelta": the same screen serves a consulting room, a court and a studio,
 * and CLAUDE.md's non-negotiable is that no base component speaks one
 * vertical's language. The owner-visible copy of a specific business can be
 * mapped later through the organization's configuration.
 *
 * None of this decides anything. Whether a payment covers a slot is
 * resolved only in PostgreSQL (`payment_covers_slot`), and the quota is
 * measured there as series in force; these functions just render what the
 * plan row already says.
 */

export const PLAN_KIND_LABEL: Record<ServicePlanKind, string> = {
  DROP_IN: "Turno suelto",
  WEEKLY_QUOTA: "Turnos fijos por semana",
  UNLIMITED: "Libre",
};

/** The one-line answer to "qué da este plan". */
export function planSummary(planKind: ServicePlanKind, weeklyQuota: number | null): string {
  if (planKind === "DROP_IN") {
    return "Un turno por vez";
  }

  if (planKind === "WEEKLY_QUOTA") {
    // The quota is a count of standing reservations, not of bookings
    // inside a week (ADR-0024) -- the wording says "fijos" for that
    // reason: they are specific weekly slots, not a weekly allowance.
    const quota = weeklyQuota ?? 0;
    return quota === 1 ? "1 turno fijo por semana" : `${quota} turnos fijos por semana`;
  }

  return "Turnos sin límite en el período";
}

/**
 * How the period a payment buys is counted.
 *
 * ADR-0031: `billingPeriodMonths` is optional and defaults to 1, so every
 * existing call site keeps saying exactly what it said before. `null` and
 * `1` mean the same thing here, as in the database.
 */
export function planBillingLabel(
  billingType: BillingType,
  billingCycle: BillingCycle | null,
  billingPeriodMonths?: number | null,
): string {
  if (billingType === "MONTHLY") {
    // A long cycle whose length the caller does not know (the public
    // catalog does not carry it yet): never call it "Mensual" -- that
    // would present a quarterly price as a monthly one.
    if (isLongCycle(billingCycle) && (billingPeriodMonths === null || billingPeriodMonths === undefined)) {
      return "Se cobra por período de varios meses";
    }

    const months = billingPeriodMonths ?? 1;

    if (months > 1) {
      return billingCycle === "ROLLING_PERIOD"
        ? `Cada ${months} meses · desde el pago`
        : `Cada ${months} meses · bloque fijo del año`;
    }

    return billingCycle === "ROLLING_MONTH" || billingCycle === "ROLLING_PERIOD"
      ? "Mensual · mes desde el pago"
      : "Mensual · mes calendario";
  }

  if (billingType === "ONE_TIME") {
    return "Se cobra por vez";
  }

  return "Sin cobro";
}

/**
 * Suffix next to a price, so "2.500 / mes" doesn't read as a one-off.
 *
 * `billingCycle` is optional: pass it where the months may be unknown (the
 * public catalog), so a long-cycle price is never suffixed " / mes".
 */
export function planPriceSuffix(
  billingType: BillingType,
  billingPeriodMonths?: number | null,
  billingCycle?: BillingCycle | null,
): string {
  if (billingType !== "MONTHLY") return "";
  if (isLongCycle(billingCycle ?? null) && (billingPeriodMonths === null || billingPeriodMonths === undefined)) {
    return " / período";
  }
  const months = billingPeriodMonths ?? 1;
  return months > 1 ? ` / ${months} meses` : " / mes";
}

/** ADR-0031: the two cycles that span `billingPeriodMonths` months. */
function isLongCycle(billingCycle: BillingCycle | null): boolean {
  return billingCycle === "CALENDAR_PERIOD" || billingCycle === "ROLLING_PERIOD";
}

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  CALENDAR_MONTH: "Mes calendario (del 1 al último día)",
  ROLLING_MONTH: "Mes desde el pago (30 días corridos)",
  // ADR-0031: los dos ciclos largos. Cuántos meses dura el bloque lo dice
  // billingPeriodMonths, no la etiqueta del ciclo.
  CALENDAR_PERIOD: "Bloque fijo del año (arranca siempre el mismo mes)",
  ROLLING_PERIOD: "Bloque desde el pago (arranca el día que paga)",
};

/**
 * ADR-0029: only shown when a WEEKLY_QUOTA plan covers more than one
 * service -- a single-service plan is PER_SERVICE in effect and the
 * distinction is meaningless to show.
 */
export const QUOTA_SCOPE_LABEL: Record<PlanQuotaScope, string> = {
  PER_SERVICE: "Cada servicio tiene su propio cupo",
  SHARED_ACROSS_SERVICES: "Un cupo compartido entre todos",
};

/** "Pilates + Musculación", or "Todos los servicios" for a live-resolved plan. */
export function planScopeLabel(
  appliesToAllServices: boolean,
  serviceIds: string[],
  serviceNameById: Record<string, string>,
): string {
  if (appliesToAllServices) return "Todos los servicios";
  return serviceIds.map((id) => serviceNameById[id] ?? "Servicio").join(" + ") || "Sin servicios";
}
