// Plain module, not a "use server" file: a server-action module can only
// export async functions, and this table is read by both server and
// client components.

/** can_customer_book()/book_slot() reason codes, in words a customer can act on. */
export const BOOKING_REASONS: Record<string, string> = {
  AUTH_REQUIRED: "Necesitás iniciar sesión",
  NOT_A_CUSTOMER:
    "Todavía no sos cliente de este negocio. Escribiles para que te habiliten y después vas a poder reservar.",
  ORGANIZATION_INACTIVE: "Este negocio no está aceptando reservas",
  SERVICE_INACTIVE: "Este servicio ya no está disponible",
  OCCURRENCE_NOT_AVAILABLE: "Ese horario ya no está disponible",
  PAYMENT_REQUIRED: "Tu pago no cubre esa fecha. Regularizá con el negocio para reservar.",
  SLOT_FULL: "Se completaron los lugares mientras elegías",
  ALREADY_BOOKED: "Ya tenés una reserva para este horario",
  DUPLICATE: "Ya tenés una reserva para este horario",

  // ADR-0024. These three exist precisely so that nobody who just paid is
  // told "tenés que pagar" -- collapsing them into PAYMENT_REQUIRED is the
  // error ADR-0018 and Phase 12 each had to correct once already. Each one
  // has a different remedy, so each one says it.
  OUTSIDE_PLAN_QUOTA:
    "Tu mes está pago, pero este turno no es uno de tus horarios fijos. Consultá al negocio para tomarlo aparte o sumarlo a tu plan.",
  OVER_PLAN_QUOTA:
    "Tu plan cubre menos horarios fijos por semana que los que tenés agendados. Para sumar este, cambiá de plan o liberá otro horario.",
  SERVICE_HAS_NO_PLAN:
    "Este servicio todavía no tiene precios publicados. Escribile al negocio: no es algo que puedas resolver vos.",
};

/**
 * How to *show* a `can_book_reason` — what to say is `BOOKING_REASONS` above,
 * this is the color/icon/urgency. Three buckets, because one red banner for
 * all of them is how a customer reads "se completaron los lugares" (nobody's
 * fault, just timing) as "hice algo mal":
 *
 * - `neutral` — the slot changed while they were looking. Nothing to fix,
 *   nothing to blame, just pick another one.
 * - `customer` — there's something *they* can do right now: log in, pay,
 *   ask to join a plan. Reads as a warning because it's actionable.
 * - `owner` — the business hasn't configured something (no plan published,
 *   inactive service/org). Trying again or paying does nothing, so this
 *   reads as the harder stop — the copy already says "escribile al negocio".
 */
export type BookingReasonTone = "neutral" | "customer" | "owner";

const NEUTRAL_REASONS = new Set([
  "SLOT_FULL",
  "OCCURRENCE_NOT_AVAILABLE",
  "ALREADY_BOOKED",
  "DUPLICATE",
]);

const OWNER_FAULT_REASONS = new Set([
  "ORGANIZATION_INACTIVE",
  "SERVICE_INACTIVE",
  "SERVICE_HAS_NO_PLAN",
]);

export function bookingReasonTone(code: string): BookingReasonTone {
  if (NEUTRAL_REASONS.has(code)) return "neutral";
  if (OWNER_FAULT_REASONS.has(code)) return "owner";
  return "customer";
}

/**
 * The same reason codes, worded for whoever is standing at the desk: short
 * enough to read in a list of dates, and naming the action *the business*
 * has to take rather than the one the customer has to.
 */
export const DESK_BOOKING_REASONS: Record<string, string> = {
  OK: "Se reserva",
  PAYMENT_REQUIRED: "El pago no cubre esa fecha",
  SLOT_FULL: "Completo",
  ALREADY_BOOKED: "Ya está anotado",
  DUPLICATE: "Ya está anotado",
  NOT_A_CUSTOMER: "No es cliente",
  OCCURRENCE_NOT_AVAILABLE: "Turno no disponible",
  SERVICE_INACTIVE: "Servicio inactivo",
  ORGANIZATION_INACTIVE: "Organización inactiva",
  AUTH_REQUIRED: "Sin sesión",
  NO_ENTITLEMENT: "Sin permiso vigente",

  // ADR-0024: "cobrale el mes" does nothing for these two, which is the
  // whole reason they are separate codes.
  OUTSIDE_PLAN_QUOTA: "Pago al día, pero fuera de sus horarios fijos",
  OVER_PLAN_QUOTA: "Excede la frecuencia del plan",
  SERVICE_HAS_NO_PLAN: "El servicio no tiene ningún plan activo",
};
