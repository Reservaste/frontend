import { describe, expect, it } from "vitest";
import type { CustomerServicePlanQuota, CustomerStandingReservation } from "@/app/actions/standing";
import { groupStandingReservationsByService, quotaBadgeFor } from "./standing-quota";

function makeReservation(
  overrides: Partial<CustomerStandingReservation> = {},
): CustomerStandingReservation {
  return {
    recurringBookingId: "rb-1",
    scheduleRuleId: "sr-1",
    serviceId: "svc-1",
    serviceName: "Pilates",
    weekday: 1,
    localStartTime: "09:00:00",
    durationMinutes: 60,
    status: "ACTIVE",
    createdAt: "2026-01-01T00:00:00Z",
    upcomingConfirmed: 4,
    upcomingNotGenerated: 0,
    upcomingUnpaid: 0,
    upcomingOverQuota: 0,
    upcomingBeyondPeriod: 0,
    ...overrides,
  };
}

function makeQuota(overrides: Partial<CustomerServicePlanQuota> = {}): CustomerServicePlanQuota {
  return {
    serviceId: "svc-1",
    serviceName: "Pilates",
    servicePlanId: "plan-1",
    planName: "Pilates Reformer 2 x S",
    planKind: "WEEKLY_QUOTA",
    weeklyQuota: 2,
    quotaScope: "PER_SERVICE",
    assignedCount: 1,
    ...overrides,
  };
}

describe("quotaBadgeFor", () => {
  it("returns null when the plan has no weekly quota to show (real risk branch)", () => {
    // No plan in force today, or a DROP_IN/UNLIMITED plan -- there is
    // nothing to warn about, and the section must simply omit the badge
    // rather than show something misleading.
    expect(quotaBadgeFor(makeQuota({ weeklyQuota: null }))).toBeNull();
  });

  it("returns null when there is no quota row at all for the service", () => {
    expect(quotaBadgeFor(undefined)).toBeNull();
  });

  it("warns when the customer hasn't filled the plan's weekly quota yet", () => {
    const badge = quotaBadgeFor(makeQuota({ weeklyQuota: 2, assignedCount: 1 }));
    expect(badge).toEqual({ tone: "warning", label: "1 de 2 turnos fijos asignados" });
  });

  it("is neutral once the customer has filled (or exceeded) the quota", () => {
    const full = quotaBadgeFor(makeQuota({ weeklyQuota: 2, assignedCount: 2 }));
    expect(full).toEqual({ tone: "neutral", label: "2 de 2 turnos fijos asignados" });

    const over = quotaBadgeFor(makeQuota({ weeklyQuota: 2, assignedCount: 3 }));
    expect(over?.tone).toBe("neutral");
  });

  it("agrees in number for a single weekly slot", () => {
    const badge = quotaBadgeFor(makeQuota({ weeklyQuota: 1, assignedCount: 0 }));
    expect(badge?.label).toBe("0 de 1 turno fijo asignado");
  });
});

describe("groupStandingReservationsByService", () => {
  it("returns an empty list for an empty input", () => {
    expect(groupStandingReservationsByService([])).toEqual([]);
  });

  it("groups reservations from 2+ distinct services, in first-seen order", () => {
    const reservations = [
      makeReservation({ recurringBookingId: "rb-1", serviceId: "svc-pilates", serviceName: "Pilates" }),
      makeReservation({ recurringBookingId: "rb-2", serviceId: "svc-cancha", serviceName: "Cancha" }),
      makeReservation({ recurringBookingId: "rb-3", serviceId: "svc-pilates", serviceName: "Pilates" }),
    ];

    const groups = groupStandingReservationsByService(reservations);

    expect(groups).toHaveLength(2);
    expect(groups[0].serviceId).toBe("svc-pilates");
    expect(groups[0].reservations.map((r) => r.recurringBookingId)).toEqual(["rb-1", "rb-3"]);
    expect(groups[1].serviceId).toBe("svc-cancha");
    expect(groups[1].reservations.map((r) => r.recurringBookingId)).toEqual(["rb-2"]);
  });

  it("drops non-ACTIVE reservations defensively", () => {
    const reservations = [
      makeReservation({ recurringBookingId: "rb-1", status: "CANCELLED" }),
      makeReservation({ recurringBookingId: "rb-2", status: "ACTIVE" }),
    ];

    const groups = groupStandingReservationsByService(reservations);

    expect(groups).toHaveLength(1);
    expect(groups[0].reservations.map((r) => r.recurringBookingId)).toEqual(["rb-2"]);
  });
});
