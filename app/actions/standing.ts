"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

// Standing reservations: a customer who holds the same weekly slot every
// week (the "pays monthly for Mondays 09:00 Pilates" case). The
// RecurringBooking engine lives in SQL; these are the front-desk entry
// points into it. Membership is enforced inside each RPC -- calling
// requireOrganizationMembership here is for clean redirects, not security.

export interface StandingReservation {
  recurringBookingId: string;
  customerId: string;
  customerName: string;
  status: "ACTIVE" | "CANCELLED";
  createdAt: string;
  upcomingConfirmed: number;
  upcomingNotGenerated: number;
  /**
   * Of the dates that didn't confirm, how many are waiting on a payment
   * **that can be charged today**.
   *
   * Fase 25: esto contaba todas las fechas impagas de la ventana rodante
   * de 90 días (ADR-0009). Un pago mensual nunca cubre noventa días, así
   * que el contador quedaba > 0 para todo cliente y la etiqueta "Falta el
   * pago" no se apagaba nunca, ni para alguien con el mes al día. Ahora se
   * corta en el período vigente; lo de más adelante va en
   * `upcomingBeyondPeriod`.
   */
  upcomingUnpaid: number;
  /**
   * How many of the upcoming dates fall outside the frequency the
   * customer's plan bought (ADR-0024). Charging the month again does
   * nothing for these -- the fix is a bigger plan or one series fewer --
   * which is exactly why they are counted apart from `upcomingUnpaid`.
   */
  upcomingOverQuota: number;
  /**
   * Fechas del horario fijo que caen más allá del período que el cliente
   * ya compró. No son una deuda: el lugar le sigue quedando reservado y
   * se confirman solas cuando pague ese mes (ADR-0019). Se cuentan aparte
   * justamente para que no se lean como "falta el pago".
   */
  upcomingBeyondPeriod: number;
}

interface StandingReservationRow {
  recurring_booking_id: string;
  customer_id: string;
  customer_name: string;
  status: StandingReservation["status"];
  created_at: string;
  upcoming_confirmed: number;
  upcoming_not_generated: number;
  upcoming_unpaid: number;
  upcoming_over_quota: number;
  upcoming_beyond_period: number;
}

function mapStandingReservation(row: StandingReservationRow): StandingReservation {
  return {
    recurringBookingId: row.recurring_booking_id,
    customerId: row.customer_id,
    customerName: row.customer_name,
    status: row.status,
    createdAt: row.created_at,
    upcomingConfirmed: row.upcoming_confirmed,
    upcomingNotGenerated: row.upcoming_not_generated,
    upcomingUnpaid: row.upcoming_unpaid,
    upcomingOverQuota: row.upcoming_over_quota,
    upcomingBeyondPeriod: row.upcoming_beyond_period,
  };
}

export async function listStandingReservations(
  organizationSlug: string,
  scheduleRuleId: string,
): Promise<StandingReservation[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("schedule_rule_standing_reservations", {
    p_schedule_rule_id: scheduleRuleId,
  });

  if (error || !data) return [];

  return (data as StandingReservationRow[]).map(mapStandingReservation);
}

export type StandingOccurrenceStatus = "CONFIRMED" | "UNPAID" | "OVER_QUOTA" | "BEYOND_PERIOD" | "UNAVAILABLE";

export interface StandingOccurrence {
  slotOccurrenceId: string;
  startAt: string;
  /**
   * El mismo vocabulario que `StandingCreateSummary`
   * (confirmed/unpaid/overQuota/beyondPeriod/unavailable), fila por fila
   * en vez de agregado. Viene ya calculado por
   * `recurring_booking_occurrences()` -- no se re-deriva acá.
   */
  status: StandingOccurrenceStatus;
}

interface StandingOccurrenceRow {
  slot_occurrence_id: string;
  start_at: string;
  display_status: StandingOccurrenceStatus;
}

/**
 * El detalle fecha por fecha de una serie **ya activa**: qué está
 * confirmado y qué no, y por qué. Distinto de `previewStandingReservation`
 * (que evalúa una serie prospectiva, todavía no creada -- ver comentario
 * en la migración de Fase 38): esta lee lo que la serie ya tiene generado,
 * nunca reevalúa nada.
 */
export async function listStandingReservationOccurrences(
  organizationSlug: string,
  recurringBookingId: string,
): Promise<StandingOccurrence[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("recurring_booking_occurrences", {
    p_recurring_booking_id: recurringBookingId,
  });

  if (error || !data) return [];

  return (data as StandingOccurrenceRow[]).map((row) => ({
    slotOccurrenceId: row.slot_occurrence_id,
    startAt: row.start_at,
    status: row.display_status,
  }));
}

export interface StandingPreviewDate {
  slotOccurrenceId: string;
  startAt: string;
  canBook: string;
}

export interface StandingPreviewState {
  error: string | null;
  customerId: string | null;
  dates: StandingPreviewDate[];
}

/**
 * El detalle fecha por fecha: cuáles de las próximas ocurrencias
 * confirmarían y por qué las otras no.
 *
 * ADR-0012 pedía esto **antes** de cada confirmación. En el mostrador esa
 * obligación resultó ser un peaje: asignar un cupo fijo es una decisión ya
 * tomada ("este cliente tiene los lunes a las 9"), y la lista intermedia
 * sólo agregaba un paso a la operación más repetida de la pantalla. Sigue
 * disponible como camino secundario ("ver detalle antes de confirmar")
 * para el caso en que el mostrador sí quiera revisar fecha por fecha, pero
 * `createStandingReservation()` ya no depende de haber pasado por acá: el
 * resumen que devuelve al confirmar cuenta la misma historia en agregado,
 * y ninguna validación vivía en el preview (todas están en la RPC).
 */
export async function previewStandingReservation(
  organizationSlug: string,
  scheduleRuleId: string,
  _prev: StandingPreviewState,
  formData: FormData,
): Promise<StandingPreviewState> {
  await requireOrganizationMembership(organizationSlug);
  const customerId = String(formData.get("customerId") ?? "");

  if (!customerId) {
    return { error: "Elegí un cliente", customerId: null, dates: [] };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_preview_recurring_booking", {
    p_schedule_rule_id: scheduleRuleId,
    p_customer_id: customerId,
    p_count: 8,
  });

  if (error) {
    return { error: "No se pudieron consultar las fechas", customerId: null, dates: [] };
  }

  return {
    error: null,
    customerId,
    dates: (data ?? []).map((row: { slot_occurrence_id: string; start_at: string; can_book: string }) => ({
      slotOccurrenceId: row.slot_occurrence_id,
      startAt: row.start_at,
      canBook: row.can_book,
    })),
  };
}

/**
 * Qué produjo la serie recién creada, en agregado.
 *
 * Es lo que reemplaza al preview obligatorio en el camino rápido: sin
 * esto, "Horario fijo asignado" a secas no distingue entre un cliente al
 * que se le confirmaron las doce fechas y uno al que no se le confirmó
 * ninguna porque debe el mes. Las cuatro categorías son disjuntas y suman
 * `pending` (ver `schedule_rule_standing_reservations()`, Fase 25).
 */
export interface StandingCreateSummary {
  /** Fechas futuras que quedaron CONFIRMED ya mismo. */
  confirmed: number;
  /** Fechas futuras en NOT_GENERATED: el lugar sigue guardado, pero todavía no es una reserva. */
  pending: number;
  /** De las pendientes, las que esperan un pago **cobrable hoy** (ADR-0019). */
  unpaid: number;
  /** De las pendientes, las que exceden la frecuencia que compró el plan (ADR-0024). */
  overQuota: number;
  /** De las pendientes, las que caen más allá del período vigente: no son deuda (Fase 25). */
  beyondPeriod: number;
  /** El resto de las pendientes: hoy, la clase llena o una reserva suelta duplicada. */
  unavailable: number;
}

export interface StandingActionState {
  error: string | null;
  success: string | null;
  /**
   * Presente sólo cuando la serie se creó. Opcional a propósito: deja que
   * un `initialState` viejo (`{ error: null, success: null }`) siga
   * tipando.
   */
  summary?: StandingCreateSummary | null;
}

/**
 * Una frase para el mostrador, construida desde el resumen. Vive acá y no
 * en el componente porque es la traducción de los mismos códigos de
 * `not_generated_reason` que ya traduce el resto de esta pantalla, y
 * partirla en dos vocabularios es exactamente cómo empiezan a discrepar.
 */
function describeStandingOutcome(summary: StandingCreateSummary): string {
  // Sin fecha de fin no es una opción que se elija: recurring_bookings
  // nace con end_date null y la ventana rodante de ADR-0009 le va
  // agregando fechas mientras la serie esté ACTIVE. Decirlo acá es la
  // única forma que tiene el mostrador de saberlo.
  const head =
    summary.confirmed > 0
      ? `Horario fijo asignado: ${summary.confirmed} ${summary.confirmed === 1 ? "fecha confirmada" : "fechas confirmadas"}. Se repite todas las semanas, sin fecha de fin, hasta que lo quites.`
      : "Horario fijo asignado. Se repite todas las semanas, sin fecha de fin, hasta que lo quites.";

  const pendientes: string[] = [];
  if (summary.unpaid > 0) {
    pendientes.push(`${summary.unpaid} esperan el pago y se confirman solas cuando lo registres`);
  }
  if (summary.overQuota > 0) {
    pendientes.push(`${summary.overQuota} exceden la frecuencia que cubre su plan`);
  }
  if (summary.beyondPeriod > 0) {
    pendientes.push(`${summary.beyondPeriod} caen más adelante que el período que ya pagó`);
  }
  if (summary.unavailable > 0) {
    pendientes.push(`${summary.unavailable} no tienen lugar por ahora`);
  }

  if (pendientes.length === 0) return head;

  return `${head} Quedan ${summary.pending} sin confirmar: ${pendientes.join("; ")}.`;
}

/**
 * Asigna el cupo fijo. **No requiere haber pedido el preview**: sólo
 * necesita el `customerId`, y todas las validaciones (membresía, cliente
 * de la organización, serie duplicada, cupo del plan) viven dentro de
 * `admin_create_recurring_booking()`, no en la pantalla previa. Lo que se
 * perdía al saltear el detalle era información, no protección — por eso
 * se devuelve el resumen de qué pasó con las fechas.
 */
export async function createStandingReservation(
  organizationSlug: string,
  serviceId: string,
  scheduleRuleId: string,
  _prev: StandingActionState,
  formData: FormData,
): Promise<StandingActionState> {
  await requireOrganizationMembership(organizationSlug);
  const customerId = String(formData.get("customerId") ?? "");

  if (!customerId) {
    return { error: "Elegí un cliente", success: null, summary: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_recurring_booking", {
    p_schedule_rule_id: scheduleRuleId,
    p_customer_id: customerId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_HAS_STANDING_RESERVATION")) {
      return { error: "Ese cliente ya tiene este horario fijo", success: null, summary: null };
    }
    if (message.includes("NOT_A_CUSTOMER")) {
      return { error: "Esa persona no es cliente de esta organización", success: null, summary: null };
    }
    if (message.includes("NOT_AUTHORIZED")) {
      return { error: "No tenés permiso para hacer esto", success: null, summary: null };
    }
    // ADR-0024's soft gate: only fires when the customer *has* a plan with
    // a frequency in force, so "cobrale el mes" is the wrong advice here.
    if (message.includes("OVER_PLAN_QUOTA")) {
      return {
        error:
          "Este cliente ya usa todos los horarios fijos que cubre su plan. Cambialo a un plan con más frecuencia, o quitale otro horario fijo.",
        success: null,
        summary: null,
      };
    }
    return { error: "No se pudo crear el horario fijo", success: null, summary: null };
  }

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);

  const summary = await summarizeStandingReservation(
    supabase,
    scheduleRuleId,
    (data as { id?: string } | null)?.id ?? null,
    customerId,
  );

  // La serie ya existe: que el resumen no se pueda leer no la deshace.
  if (!summary) return { error: null, success: "Horario fijo asignado", summary: null };

  return { error: null, success: describeStandingOutcome(summary), summary };
}

/**
 * Relee la serie recién creada para contar en qué quedó cada fecha. Es una
 * segunda ida a la base a propósito: `admin_create_recurring_booking()`
 * devuelve la fila de `recurring_bookings`, no el estado de los `Booking`
 * que generó, y cambiarle la firma a la RPC rompería a todos sus llamadores
 * para un dato que sólo necesita esta pantalla.
 */
async function summarizeStandingReservation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  scheduleRuleId: string,
  recurringBookingId: string | null,
  customerId: string,
): Promise<StandingCreateSummary | null> {
  const { data, error } = await supabase.rpc("schedule_rule_standing_reservations", {
    p_schedule_rule_id: scheduleRuleId,
  });

  if (error || !data) return null;

  const row = (data as StandingReservationRow[]).find((r) =>
    recurringBookingId
      ? r.recurring_booking_id === recurringBookingId
      : r.customer_id === customerId && r.status === "ACTIVE",
  );

  if (!row) return null;

  const reservation = mapStandingReservation(row);
  return {
    confirmed: reservation.upcomingConfirmed,
    pending: reservation.upcomingNotGenerated,
    unpaid: reservation.upcomingUnpaid,
    overQuota: reservation.upcomingOverQuota,
    beyondPeriod: reservation.upcomingBeyondPeriod,
    // Lo que queda después de las tres categorías explicadas: hoy es
    // SLOT_FULL o DUPLICATE. Se calcula por resta para que un motivo nuevo
    // en la base no desaparezca silenciosamente de la cuenta.
    unavailable: Math.max(
      0,
      reservation.upcomingNotGenerated -
        reservation.upcomingUnpaid -
        reservation.upcomingOverQuota -
        reservation.upcomingBeyondPeriod,
    ),
  };
}

/** <form action> target: React requires a void return. */
export async function cancelStandingReservation(
  organizationSlug: string,
  serviceId: string,
  recurringBookingId: string,
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("cancel_recurring_booking", { p_recurring_booking_id: recurringBookingId });

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);
}
