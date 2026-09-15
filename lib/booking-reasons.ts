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
  NO_ENTITLEMENT: "No tenés este servicio habilitado. Consultá con el negocio.",
  PAYMENT_REQUIRED: "Tu pago no cubre esa fecha. Regularizá con el negocio para reservar.",
  SLOT_FULL: "Se completaron los lugares mientras elegías",
  ALREADY_BOOKED: "Ya tenés una reserva para este horario",
  DUPLICATE: "Ya tenés una reserva para este horario",
};

