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

  // ADR-0047: reserva abierta. Las primeras dos son de timing (nadie hizo
  // nada mal, el tope es de la organización, no de esta persona); la
  // tercera es accionable (escribirle al negocio); la cuarta tapa a
  // propósito dos causas internas (tope de plan, suscripción inactiva) que
  // nunca se le pueden mostrar en crudo a alguien sin cuenta todavía.
  RATE_LIMITED_HOURLY:
    "Hay demasiadas altas nuevas en este negocio en este momento. Probá de nuevo en un rato.",
  RATE_LIMITED_DAILY:
    "Se alcanzó el máximo de altas nuevas de hoy para este negocio. Probá de nuevo mañana.",
  SELF_SERVICE_BOOKING_LIMIT_REACHED:
    "Ya tenés el máximo de reservas propias permitidas sin ser cliente habilitado. Escribile al negocio para que te den de alta y puedas seguir reservando.",
  ORGANIZATION_NOT_ACCEPTING_NEW_CUSTOMERS: "Este negocio no está aceptando clientes nuevos por ahora.",
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
  // ADR-0047: topes de la organización, no de esta persona -- mismo
  // bucket que SLOT_FULL, es timing, no algo que arreglar.
  "RATE_LIMITED_HOURLY",
  "RATE_LIMITED_DAILY",
]);

const OWNER_FAULT_REASONS = new Set([
  "ORGANIZATION_INACTIVE",
  "SERVICE_INACTIVE",
  "SERVICE_HAS_NO_PLAN",
  // ADR-0047: mensaje deliberadamente genérico que tapa tope de plan o
  // suscripción inactiva -- mismo bucket que ORGANIZATION_INACTIVE.
  "ORGANIZATION_NOT_ACCEPTING_NEW_CUSTOMERS",
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

  // `StandingOccurrenceStatus` (recurring_booking_occurrences()): el estado
  // fecha por fecha de una serie ya activa, no un código de can_book. Mismo
  // diccionario porque son la misma pregunta ("¿por qué esta fecha sí/no?")
  // para dos pantallas distintas -- separarlo en dos tablas es como
  // empiezan a discrepar.
  CONFIRMED: "Confirmada",
  UNPAID: "Espera el pago del período para confirmarse",
  OVER_QUOTA: "Excede la frecuencia del plan",
  BEYOND_PERIOD: "Fuera del período pagado, se confirma sola",
  UNAVAILABLE: "Sin lugar por ahora",
};
