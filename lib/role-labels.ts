import type { OrganizationPermissions, OrgPermission } from "@reservaste/domain";

/**
 * ADR-0033: how each configurable permission reads to an owner. Keys are the
 * domain's `OrgPermission`, so a sixth permission is a type error here
 * instead of a silently missing row in the form.
 */
export const PERMISSION_COPY: Record<OrgPermission, { label: string; hint: string }> = {
  VIEW_PAYMENTS: {
    label: "Ver pagos",
    hint: "La pestaña Pagos y la deuda en la ficha de cada cliente.",
  },
  MANAGE_PAYMENTS: {
    label: "Registrar y anular pagos",
    hint: "Cobrar en el mostrador. Incluye ver pagos.",
  },
  MANAGE_BOOKINGS: {
    label: "Gestionar reservas",
    hint: "Anotar clientes, cancelar reservas de otros, cancelar turnos y horarios fijos.",
  },
  MANAGE_CUSTOMERS: {
    label: "Gestionar clientes",
    hint: "Dar de alta y de baja clientes y mandarles el link de activación.",
  },
  MANAGE_ATTENDANCE: {
    label: "Tomar asistencia",
    hint: "Marcar presente o ausente.",
  },
};

/**
 * One readable line of what a role can do -- "Pagos: ver y registrar ·
 * Reservas · Clientes · Asistencia" -- so the owner can tell at a glance what
 * they signed, instead of decoding five bare icons (docs/api.md, Fase 32).
 */
export function rolePermissionSummary(permissions: OrganizationPermissions): string {
  const parts: string[] = [];

  if (permissions.canManagePayments) parts.push("Pagos: ver y registrar");
  else if (permissions.canViewPayments) parts.push("Pagos: sólo ver");

  if (permissions.canManageBookings) parts.push("Reservas");
  if (permissions.canManageCustomers) parts.push("Clientes");
  if (permissions.canManageAttendance) parts.push("Asistencia");

  return parts.length > 0 ? parts.join(" · ") : "Sólo ver la agenda y el padrón";
}
