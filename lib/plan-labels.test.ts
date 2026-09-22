import { describe, expect, it } from "vitest";
import { BOOKING_REASONS, DESK_BOOKING_REASONS } from "./booking-reasons";
import { formatMoney } from "./money";
import { planBillingLabel, planPriceSuffix, planSummary } from "./plan-labels";

describe("planSummary", () => {
  it("says what each kind of plan buys", () => {
    expect(planSummary("DROP_IN", null)).toBe("Un turno por vez");
    expect(planSummary("UNLIMITED", null)).toBe("Turnos sin límite en el período");
  });

  it("agrees in number with the quota", () => {
    expect(planSummary("WEEKLY_QUOTA", 1)).toBe("1 turno fijo por semana");
    expect(planSummary("WEEKLY_QUOTA", 3)).toBe("3 turnos fijos por semana");
  });

  it("never names one vertical", () => {
    // CLAUDE.md, non-negotiable: no base screen says "clase", "socio" or
    // "entrenador". The same plan list serves a court and a clinic.
    const forbidden = /clase|socio|entrenador|gimnasio|alumno/i;
    for (const summary of [
      planSummary("DROP_IN", null),
      planSummary("WEEKLY_QUOTA", 2),
      planSummary("UNLIMITED", null),
    ]) {
      expect(summary).not.toMatch(forbidden);
    }
  });
});

describe("planBillingLabel", () => {
  it("tells the two monthly cycles apart", () => {
    // They are a real difference: a calendar month paid on the 15th covers
    // from the 1st, a rolling one does not.
    expect(planBillingLabel("MONTHLY", "CALENDAR_MONTH")).toBe("Mensual · mes calendario");
    expect(planBillingLabel("MONTHLY", "ROLLING_MONTH")).toBe("Mensual · mes desde el pago");
  });

  it("does not hang a monthly suffix on a one-off price", () => {
    expect(planPriceSuffix("ONE_TIME")).toBe("");
    expect(planPriceSuffix("MONTHLY")).toBe(" / mes");
  });
});

describe("formatMoney", () => {
  it("renders an absent amount as a dash, not as zero", () => {
    expect(formatMoney(null, "UYU")).toBe("—");
    expect(formatMoney(undefined, "UYU")).toBe("—");
  });

  it("never throws on a currency code Intl doesn't know", () => {
    // organizations.currency is only CHECKed as three uppercase letters, so
    // a code Intl rejects can reach a price. Failing to render a price is
    // worse than rendering it plainly.
    expect(() => formatMoney(1500, "ZZZZ")).not.toThrow();
    expect(formatMoney(1500, "ZZZZ")).toContain("ZZZZ");
  });
});

describe("booking reasons", () => {
  it("gives the ADR-0024 reasons their own wording", () => {
    // The whole point of these codes is not telling someone who just paid
    // that they have to pay. If any of them collapsed into the
    // PAYMENT_REQUIRED wording, that bug would be back.
    for (const code of ["OUTSIDE_PLAN_QUOTA", "OVER_PLAN_QUOTA", "SERVICE_HAS_NO_PLAN"]) {
      expect(BOOKING_REASONS[code]).toBeTruthy();
      expect(BOOKING_REASONS[code]).not.toBe(BOOKING_REASONS.PAYMENT_REQUIRED);
      expect(DESK_BOOKING_REASONS[code]).toBeTruthy();
      expect(DESK_BOOKING_REASONS[code]).not.toBe(DESK_BOOKING_REASONS.PAYMENT_REQUIRED);
    }
  });

  it("does not tell a customer who is up to date to pay", () => {
    expect(BOOKING_REASONS.OUTSIDE_PLAN_QUOTA).toMatch(/pago/i);
    expect(BOOKING_REASONS.OUTSIDE_PLAN_QUOTA).not.toMatch(/regulariz/i);
  });
});
