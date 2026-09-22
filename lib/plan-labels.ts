import type { BillingCycle, BillingType, ServicePlanKind } from "@reservaste/domain";

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

/** How the period a payment buys is counted. */
export function planBillingLabel(
  billingType: BillingType,
  billingCycle: BillingCycle | null,
): string {
  if (billingType === "MONTHLY") {
    return billingCycle === "ROLLING_MONTH"
      ? "Mensual · mes desde el pago"
      : "Mensual · mes calendario";
  }

  if (billingType === "ONE_TIME") {
    return "Se cobra por vez";
  }

  return "Sin cobro";
}

/** Suffix next to a price, so "2.500 / mes" doesn't read as a one-off. */
export function planPriceSuffix(billingType: BillingType): string {
  return billingType === "MONTHLY" ? " / mes" : "";
}

export const BILLING_CYCLE_LABEL: Record<BillingCycle, string> = {
  CALENDAR_MONTH: "Mes calendario (del 1 al último día)",
  ROLLING_MONTH: "Mes desde el pago (30 días corridos)",
};
