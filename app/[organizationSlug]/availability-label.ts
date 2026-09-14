import type { PublicAvailabilitySlot } from "@reservaste/domain";

/**
 * Presentational only -- the actual disclosure rule (never show the real
 * number unless mode is EXACT) is enforced in the database
 * (get_public_availability, ADR-0008). This just picks Spanish copy for
 * whatever the RPC already decided to reveal.
 */
export function availabilityLabel(slot: PublicAvailabilitySlot): string {
  if (slot.mode === "EXACT") {
    return `${slot.remaining} de ${slot.capacity} disponibles`;
  }

  if (slot.mode === "LIMITED") {
    if (slot.status === "FULL") return "Completo";
    if (slot.status === "LOW") return "Últimos lugares";
    return "Disponible";
  }

  // BOOLEAN
  return slot.status === "FULL" ? "Sin disponibilidad" : "Disponible";
}
