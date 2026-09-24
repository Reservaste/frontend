import { describe, expect, it } from "vitest";
import {
  auditActionDetails,
  auditActionTitle,
  auditActorLabel,
  auditLogStartedLabel,
} from "./audit-labels";

const names = { customers: { c1: "Ana Pérez" }, plans: { p1: "Mensual 2x" } };

describe("auditActionTitle", () => {
  it("tells a void apart from any other payment status change", () => {
    expect(
      auditActionTitle({ action: "PAYMENT_STATUS_CHANGED", metadata: { status: { from: "PAID", to: "VOID" } } }),
    ).toBe("Se anuló un pago");
    expect(
      auditActionTitle({ action: "PAYMENT_STATUS_CHANGED", metadata: { status: { from: "PENDING", to: "PAID" } } }),
    ).toBe("Cambió el estado de un pago");
  });

  it("names the price change, the case that motivated the log", () => {
    expect(
      auditActionTitle({ action: "SERVICE_PLAN_UPDATED", metadata: { price: { from: 2500, to: 3400 } } }),
    ).toBe("Se cambió el precio de un plan");
  });

  it("distinguishes deactivating from reactivating a plan", () => {
    expect(
      auditActionTitle({ action: "SERVICE_PLAN_DEACTIVATED", metadata: { is_active: { from: true, to: false } } }),
    ).toBe("Se desactivó un plan");
    expect(
      auditActionTitle({ action: "SERVICE_PLAN_DEACTIVATED", metadata: { is_active: { from: false, to: true } } }),
    ).toBe("Se reactivó un plan");
  });

  it("says the account was suspended", () => {
    expect(
      auditActionTitle({
        action: "ORGANIZATION_SUBSCRIPTION_CHANGED",
        metadata: { subscription_status: { from: "ACTIVE", to: "SUSPENDED" } },
      }),
    ).toBe("Se suspendió la cuenta");
  });
});

describe("auditActionDetails", () => {
  it("shows a price diff in the organization's currency", () => {
    const details = auditActionDetails(
      { action: "SERVICE_PLAN_UPDATED", metadata: { price: { from: 2500, to: "3400" } } },
      "UYU",
      names,
    );
    expect(details).toHaveLength(1);
    expect(details[0]).toMatch(/^precio: de .*2\.500 a .*3\.400$/);
  });

  it("resolves the customer and the plan, and leaves unknown ids out", () => {
    expect(
      auditActionDetails(
        { action: "PAYMENT_CREATED", metadata: { customer_id: "c1", service_plan_id: "unknown", status: "PAID" } },
        "UYU",
        names,
      ),
    ).toEqual(["Ana Pérez", "Pagado"]);
  });

  it("never shows an internal code as a note", () => {
    expect(
      auditActionDetails(
        {
          action: "ORGANIZATION_SUBSCRIPTION_CHANGED",
          metadata: { subscription_status: { from: "ACTIVE", to: "SUSPENDED" }, note: "PLATFORM_CONSOLE" },
        },
        "UYU",
        names,
      ),
    ).toEqual(["de activa a suspendida"]);
  });
});

describe("auditActorLabel", () => {
  it("never names a platform actor", () => {
    expect(auditActorLabel({ actorId: null, actorName: null, actorIsPlatform: true })).toBe(
      "Soporte de Reservaste",
    );
  });

  it("says 'Sistema' for an action with no actor", () => {
    expect(auditActorLabel({ actorId: null, actorName: null, actorIsPlatform: false })).toBe("Sistema");
  });

  it("uses the member's name otherwise", () => {
    expect(auditActorLabel({ actorId: "u1", actorName: "Marta", actorIsPlatform: false })).toBe("Marta");
  });
});

describe("auditLogStartedLabel", () => {
  it("formats the start date as DD/MM/AAAA", () => {
    expect(auditLogStartedLabel()).toBe("23/09/2026");
  });
});
