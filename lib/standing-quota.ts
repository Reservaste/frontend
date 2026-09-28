import type { CustomerServicePlanQuota, CustomerStandingReservation } from "@/app/actions/standing";

/**
 * Presentation helpers for the "Horarios fijos" section of the customer
 * detail page (`app/org/[slug]/customers/[customerId]/page.tsx`, Fase 39).
 * Plain module, not `"use server"`: pure functions over data the Server
 * Component already fetched, same reason as `plan-labels.ts`.
 */

/** One entry per service where the customer holds at least one standing reservation. */
export interface StandingGroup {
  serviceId: string;
  serviceName: string;
  reservations: CustomerStandingReservation[];
}

/**
 * Groups `getCustomerStandingReservations()`'s flat list by service, in
 * first-seen order (not alphabetical -- reads in the same order the RPC
 * already returns them, no extra sort to keep in sync with anything else).
 * Defensive `status === "ACTIVE"` filter even though the RPC's own
 * contract says it only returns active rows (`standing.ts`) -- same
 * belt-and-suspenders the schedule page's `StandingReservations` applies
 * to the sibling RPC.
 */
export function groupStandingReservationsByService(
  reservations: CustomerStandingReservation[],
): StandingGroup[] {
  const groups: StandingGroup[] = [];
  for (const reservation of reservations) {
    if (reservation.status !== "ACTIVE") continue;
    let group = groups.find((g) => g.serviceId === reservation.serviceId);
    if (!group) {
      group = { serviceId: reservation.serviceId, serviceName: reservation.serviceName, reservations: [] };
      groups.push(group);
    }
    group.reservations.push(reservation);
  }
  return groups;
}

export interface QuotaBadge {
  tone: "warning" | "neutral";
  label: string;
}

/**
 * "2 de 2 turnos fijos asignados" (or "1 de 2"), with a soft warning tone
 * when the customer hasn't filled the plan's weekly quota yet -- the owner
 * asked for exactly this at-a-glance signal for the "Pilates Reformer 2 x
 * S" case. `null` when the plan has no quota to show (no plan in force
 * today, or a plan kind without a weekly number -- `UNLIMITED`/`DROP_IN`).
 */
export function quotaBadgeFor(quota: CustomerServicePlanQuota | undefined): QuotaBadge | null {
  if (!quota || quota.weeklyQuota === null) return null;
  const short = quota.assignedCount < quota.weeklyQuota;
  const label = `${quota.assignedCount} de ${quota.weeklyQuota} ${
    quota.weeklyQuota === 1 ? "turno fijo asignado" : "turnos fijos asignados"
  }`;
  return { tone: short ? "warning" : "neutral", label };
}
