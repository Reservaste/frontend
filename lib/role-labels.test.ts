import { describe, expect, it } from "vitest";
import { ALL_ORG_PERMISSIONS, NO_ORG_PERMISSIONS } from "@reservaste/domain";
import { rolePermissionSummary } from "./role-labels";

describe("rolePermissionSummary", () => {
  it("spells out every permission of a full role", () => {
    expect(rolePermissionSummary(ALL_ORG_PERMISSIONS)).toBe(
      "Pagos: ver y registrar · Reservas · Clientes · Asistencia",
    );
  });

  it("distinguishes seeing payments from charging them", () => {
    expect(
      rolePermissionSummary({ ...NO_ORG_PERMISSIONS, canViewPayments: true, canManageAttendance: true }),
    ).toBe("Pagos: sólo ver · Asistencia");
  });

  it("says what is left when nothing is granted", () => {
    expect(rolePermissionSummary(NO_ORG_PERMISSIONS)).toBe("Sólo ver la agenda y el padrón");
  });
});
