import { describe, expect, it } from "vitest";
import {
  canUpgradePayment,
  defaultEffectiveDate,
  isHigherPlan,
  upgradeCandidates,
  upgradeErrorMessage,
} from "./plan-upgrade";

const plan = (
  id: string,
  planKind: "DROP_IN" | "WEEKLY_QUOTA" | "UNLIMITED",
  weeklyQuota: number | null,
  extra: Partial<{ isActive: boolean; serviceIds: string[] }> = {},
) => ({ id, planKind, weeklyQuota, isActive: true, serviceIds: ["s1"], ...extra });

describe("isHigherPlan", () => {
  it("accepts more weekly turns or unlimited, rejects the rest", () => {
    const w1 = plan("a", "WEEKLY_QUOTA", 1);
    expect(isHigherPlan(w1, plan("b", "WEEKLY_QUOTA", 2))).toBe(true);
    expect(isHigherPlan(w1, plan("b", "UNLIMITED", null))).toBe(true);
    expect(isHigherPlan(w1, plan("b", "WEEKLY_QUOTA", 1))).toBe(false);
    expect(isHigherPlan(plan("a", "WEEKLY_QUOTA", 3), plan("b", "WEEKLY_QUOTA", 2))).toBe(false);
    expect(isHigherPlan(plan("a", "UNLIMITED", null), plan("b", "UNLIMITED", null))).toBe(false);
  });
});

describe("upgradeCandidates", () => {
  const current = plan("cur", "WEEKLY_QUOTA", 1);
  it("keeps only active, non drop-in, higher plans with the same scope", () => {
    const list = [
      current,
      plan("w2", "WEEKLY_QUOTA", 2),
      plan("inactive", "WEEKLY_QUOTA", 3, { isActive: false }),
      plan("dropin", "DROP_IN", null),
      plan("other", "WEEKLY_QUOTA", 3, { serviceIds: ["s2"] }),
      plan("unl", "UNLIMITED", null),
    ];
    expect(upgradeCandidates(current, list).map((p) => p.id)).toEqual(["w2", "unl"]);
  });
});

describe("defaultEffectiveDate", () => {
  it("uses today inside the period, otherwise a valid edge", () => {
    expect(defaultEffectiveDate("2026-10-15", "2026-10-01", "2026-10-31")).toBe("2026-10-15");
    expect(defaultEffectiveDate("2026-10-01", "2026-10-01", "2026-10-31")).toBe("2026-10-02");
    expect(defaultEffectiveDate("2026-09-20", "2026-10-01", "2026-10-31")).toBe("2026-10-02");
    expect(defaultEffectiveDate("2026-11-20", "2026-10-01", "2026-10-31")).toBe("2026-10-31");
  });
});

describe("canUpgradePayment", () => {
  const w1 = { planKind: "WEEKLY_QUOTA" as const };
  const base = { status: "PAID", periodStart: "2026-10-01", periodEnd: "2026-10-31" };
  it("only for a PAID period payment of a plan that can go up", () => {
    expect(canUpgradePayment(base, w1)).toBe(true);
    expect(canUpgradePayment({ ...base, status: "PENDING" }, w1)).toBe(false);
    expect(canUpgradePayment({ ...base, slotOccurrenceId: "x" }, w1)).toBe(false);
    expect(canUpgradePayment(base, { planKind: "DROP_IN" })).toBe(false);
    expect(canUpgradePayment(base, { planKind: "UNLIMITED" })).toBe(false);
    expect(canUpgradePayment(base, undefined)).toBe(false);
    expect(canUpgradePayment({ ...base, periodEnd: "2026-10-01" }, w1)).toBe(false);
  });
});

describe("upgradeErrorMessage", () => {
  it.each([
    "PAYMENT_UPGRADE_NOT_AUTHORIZED",
    "PAYMENT_UPGRADE_NOT_PAID",
    "PAYMENT_UPGRADE_NOT_PERIOD_PAYMENT",
    "PAYMENT_UPGRADE_INVALID_DATE",
    "PAYMENT_UPGRADE_PLAN_NOT_FOUND",
    "PAYMENT_UPGRADE_SAME_PLAN",
    "PAYMENT_UPGRADE_PLAN_INACTIVE",
    "PAYMENT_UPGRADE_PLAN_DROP_IN",
    "PAYMENT_UPGRADE_NOT_HIGHER_PLAN",
    "PAYMENT_UPGRADE_SCOPE_MISMATCH",
    "PAYMENT_UPGRADE_INVALID_AMOUNT",
    "payment_service_coverage_no_overlap",
    "PAYMENT_DUPLICATE_PERIOD",
  ])("translates %s without leaking the code", (code) => {
    const msg = upgradeErrorMessage(`error: ${code}`);
    expect(msg).not.toContain(code);
    expect(msg).not.toMatch(/No se pudo hacer el upgrade/);
  });

  it("falls back to a generic message", () => {
    expect(upgradeErrorMessage("boom")).toMatch(/No se pudo hacer el upgrade/);
    expect(upgradeErrorMessage(undefined)).toMatch(/No se pudo hacer el upgrade/);
  });
});
