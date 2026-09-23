"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NotGeneratedReason, ServicePlanKind } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { BOOKING_REASONS } from "@/lib/booking-reasons";

/**
 * Whether this person is a customer of any organization. Used to route
 * after login: a customer has no organization membership, so the admin
 * dashboard would otherwise push them into "create your business"
 * onboarding, which is not what they came for.
 */
export async function isCustomerSomewhere(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase.from("customers").select("id").eq("profile_id", user.id).limit(1);
  return (data?.length ?? 0) > 0;
}

export interface MyBooking {
  bookingId: string;
  status: "CONFIRMED" | "CANCELLED" | "NOT_GENERATED";
  organizationSlug: string;
  organizationName: string;
  organizationTimezone: string;
  slotOccurrenceId: string;
  serviceId: string;
  serviceName: string;
  /** ADR-0008-adjacent presentation, not disclosure: same color get_public_availability() shows for this service. */
  serviceColor: string | null;
  startAt: string;
  endAt: string;
  occurrenceStatus: "ACTIVE" | "BLOCKED" | "CANCELLED";
  cancellationReason: string | null;
  isRecurring: boolean;
  /**
   * Why a recurring date didn't confirm. Null for every other status.
   * `OVER_PLAN_QUOTA` arrived with ADR-0024: the month is paid and the
   * class isn't full -- the series just exceeds the plan's frequency, so
   * neither "falta el pago" nor "sin lugar" would be true.
   */
  notGeneratedReason: NotGeneratedReason | null;
}

export async function getMyBookings(includePast = false): Promise<MyBooking[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_bookings", { p_include_past: includePast });

  if (error || !data) return [];

  return data.map(
    (row: {
      booking_id: string;
      status: MyBooking["status"];
      organization_slug: string;
      organization_name: string;
      organization_timezone: string;
      slot_occurrence_id: string;
      service_id: string;
      service_name: string;
      service_color: string | null;
      start_at: string;
      end_at: string;
      occurrence_status: MyBooking["occurrenceStatus"];
      cancellation_reason: string | null;
      is_recurring: boolean;
      not_generated_reason: MyBooking["notGeneratedReason"];
    }) => ({
      bookingId: row.booking_id,
      status: row.status,
      organizationSlug: row.organization_slug,
      organizationName: row.organization_name,
      organizationTimezone: row.organization_timezone,
      slotOccurrenceId: row.slot_occurrence_id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      serviceColor: row.service_color,
      startAt: row.start_at,
      endAt: row.end_at,
      occurrenceStatus: row.occurrence_status,
      cancellationReason: row.cancellation_reason,
      isRecurring: row.is_recurring,
      notGeneratedReason: row.not_generated_reason,
    }),
  );
}

export interface MyService {
  serviceId: string;
  serviceName: string;
  organizationSlug: string;
  organizationName: string;
  /** ISO 4217 of the organization (ADR-0024) -- a plan has no currency of its own. */
  currency: string;
  paymentRequired: boolean;
  /**
   * The plan actually covering this customer today, resolved through
   * payment_service_coverage (ADR-0029) -- null when nothing currently
   * covers them, whether or not payment is required at all.
   */
  planName: string | null;
  planPrice: number | null;
  planKind: ServicePlanKind | null;
  coveredUntil: string | null;
  isCoveredToday: boolean;
}

/**
 * The services the customer can book, and which plan (if any) covers them
 * today (ADR-0029). Replaces the entitlement list: nobody enables a
 * service for a person any more, so there is nothing per-person to show
 * except which plan they're covered by.
 *
 * Was billingType/billingCycle/price straight off `services` until this
 * screen's own bug (2026-09-22): those columns are one number per
 * service, deprecated since ADR-0024 specifically because a service can
 * sell several plans -- a customer covered by the cheaper of two plans on
 * the same service was one query away from seeing the other one's price,
 * or a service-level number that had stopped meaning anything.
 */
export async function getMyServices(): Promise<MyService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_services");

  if (error || !data) return [];

  return data.map(
    (row: {
      service_id: string;
      service_name: string;
      organization_slug: string;
      organization_name: string;
      currency: string;
      payment_required: boolean;
      plan_name: string | null;
      plan_price: string | number | null;
      plan_kind: ServicePlanKind | null;
      covered_until: string | null;
      is_covered_today: boolean;
    }) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      organizationSlug: row.organization_slug,
      organizationName: row.organization_name,
      currency: row.currency,
      paymentRequired: row.payment_required,
      planName: row.plan_name,
      planPrice: row.plan_price === null ? null : Number(row.plan_price),
      planKind: row.plan_kind,
      coveredUntil: row.covered_until,
      isCoveredToday: row.is_covered_today,
    }),
  );
}

export interface MyCustomerOrganization {
  organizationSlug: string;
  organizationName: string;
}

/**
 * The businesses where this person is already an active Customer, whether
 * or not there is anything to show about them yet. `getMyServices()`
 * deliberately doesn't cover this: it joins `services ... where is_active`,
 * so someone just activated (WhatsApp, ADR-0026) or enrolled by email
 * (managed customers, ADR-0021) with no published/active service yet drops
 * out of that list even though the Customer link is real. Used by /me's
 * empty state so that person still gets a link to the business' agenda
 * instead of a dead end.
 */
export async function getMyCustomerOrganizations(): Promise<MyCustomerOrganization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_customer_organizations");

  if (error || !data) return [];

  return data.map((row: { organization_slug: string; organization_name: string }) => ({
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
  }));
}

export interface MyPayment {
  paymentId: string;
  organizationName: string;
  serviceName: string;
  periodStart: string;
  periodEnd: string;
  status: "PAID" | "PENDING" | "OVERDUE" | "VOID";
  amount: number | null;
}

export async function getMyPayments(): Promise<MyPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_payments");

  if (error || !data) return [];

  return data.map(
    (row: {
      payment_id: string;
      organization_name: string;
      service_name: string;
      period_start: string;
      period_end: string;
      status: MyPayment["status"];
      amount: number | null;
    }) => ({
      paymentId: row.payment_id,
      organizationName: row.organization_name,
      serviceName: row.service_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      amount: row.amount,
    }),
  );
}

export interface SlotDetail {
  slotOccurrenceId: string;
  organizationSlug: string;
  organizationName: string;
  organizationTimezone: string;
  serviceId: string;
  serviceName: string;
  startAt: string;
  endAt: string;
  mode: "EXACT" | "LIMITED" | "BOOLEAN";
  status: "AVAILABLE" | "LOW" | "FULL" | null;
  remaining: number | null;
  capacity: number | null;
}

/** Public: the summary shown on the post-login confirmation screen (ADR-0015). */
export async function getSlotDetail(slotOccurrenceId: string): Promise<SlotDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_slot_detail", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    slotOccurrenceId: row.slot_occurrence_id,
    organizationSlug: row.organization_slug,
    organizationName: row.organization_name,
    organizationTimezone: row.organization_timezone,
    serviceId: row.service_id,
    serviceName: row.service_name,
    startAt: row.start_at,
    endAt: row.end_at,
    mode: row.mode,
    status: row.status,
    remaining: row.remaining,
    capacity: row.capacity,
  };
}

export type CanBookResult =
  | "OK"
  | "AUTH_REQUIRED"
  | "NOT_A_CUSTOMER"
  | "ORGANIZATION_INACTIVE"
  | "SERVICE_INACTIVE"
  | "OCCURRENCE_NOT_AVAILABLE"
  | "PAYMENT_REQUIRED"
  | "SLOT_FULL"
  | "ALREADY_BOOKED"
  // ADR-0024. Faltaban acá aunque `BOOKING_REASONS` ya los sabía decir:
  // el tipo prometía menos motivos de los que la RPC devuelve.
  | "OUTSIDE_PLAN_QUOTA"
  | "OVER_PLAN_QUOTA"
  | "SERVICE_HAS_NO_PLAN";

/**
 * ADR-0015's read-only check. Purely so the confirmation screen can say
 * "this won't work, and here's why" instead of showing a button that is
 * known in advance to fail. It is not a gate: POST still re-evaluates
 * everything from scratch before writing.
 */
export async function checkCanBook(slotOccurrenceId: string): Promise<CanBookResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_customer_book", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  if (error) return "OCCURRENCE_NOT_AVAILABLE";
  return (data as CanBookResult) ?? "OCCURRENCE_NOT_AVAILABLE";
}

export interface CanBookDetail {
  reason: CanBookResult;
  /**
   * ADR-0025: cuando la cobertura por sí sola no alcanzaba y lo que
   * habilita la reserva es un crédito de recupero, viene acá con su fecha
   * de vencimiento. `null` en el caso normal -- nunca se gasta un crédito
   * si otra cobertura alcanzaba, así que un OK "común" no informa ninguno.
   */
  makeupCreditId: string | null;
  makeupCreditExpiresOn: string | null;
}

/**
 * Lo mismo que `checkCanBook`, con el crédito que hace posible la reserva.
 *
 * ADR-0025 ya permite usar un crédito en **cualquier** turno del mismo
 * servicio dentro de su vigencia, no sólo en el que se liberó -- está
 * verificado contra la base. Lo que faltaba es decirlo: `can_customer_book()`
 * devuelve sólo el enum, así que el portal mostraba "Reservar" y gastaba el
 * crédito en silencio, y el cliente no tenía forma de saber que ese turno
 * entraba con su crédito hasta después. No duplica ninguna regla: la RPC
 * llama a las mismas funciones que `book_slot()`.
 */
export async function checkCanBookDetail(slotOccurrenceId: string): Promise<CanBookDetail> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("can_customer_book_detail", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  const row = Array.isArray(data) ? data[0] : data;
  if (error || !row) {
    return { reason: "OCCURRENCE_NOT_AVAILABLE", makeupCreditId: null, makeupCreditExpiresOn: null };
  }

  const typed = row as {
    reason: CanBookResult;
    makeup_credit_id: string | null;
    makeup_credit_expires_on: string | null;
  };
  return {
    reason: typed.reason,
    makeupCreditId: typed.makeup_credit_id,
    makeupCreditExpiresOn: typed.makeup_credit_expires_on,
  };
}

export interface BookingActionState {
  error: string | null;
}


export async function confirmBooking(
  slotOccurrenceId: string,
  _prev: BookingActionState,
): Promise<BookingActionState> {
  const supabase = await createClient();

  // The write path re-checks everything itself (ADR-0004/ADR-0005): this
  // call is the same one an already-signed-in person makes directly, with
  // no "I came from login" shortcut.
  const { data, error } = await supabase.rpc("book_slot", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  if (error) {
    return { error: "No se pudo completar la reserva" };
  }

  const status = (data as { status: string }).status;
  if (status !== "OK") {
    return { error: BOOKING_REASONS[status] ?? "No se pudo completar la reserva" };
  }

  revalidatePath("/me");

  // Sin `org=`, /me elegía la organización con la próxima clase más
  // cercana (pickCustomerOrganization) -- para alguien con reservas en
  // varias organizaciones eso podía no ser la que acaba de reservar acá.
  // public_slot_detail() ya resuelve organizationSlug para este mismo
  // slotOccurrenceId (lo usa la pantalla de confirmación post-login,
  // ADR-0015) -- se reusa en vez de armar una consulta nueva.
  const slot = await getSlotDetail(slotOccurrenceId);
  redirect(
    slot
      ? `/me?reservado=1&org=${encodeURIComponent(slot.organizationSlug)}`
      : "/me?reservado=1",
  );
}

export async function cancelMyBooking(bookingId: string): Promise<void> {
  const supabase = await createClient();
  // Phase 19 (ADR-0025 resolución 1): cancel_booking ya no acepta el motivo
  // del caller -- se deriva del actor en la base, siempre CUSTOMER_REQUEST
  // para este camino. Aceptarlo desde acá era un crédito de recupero gratis.
  //
  // TODO(Fase L): esta llamada no revisa el error de la RPC -- una falla
  // (booking ajeno, ya cancelada) hoy es silenciosa para el usuario. Ya
  // existen Alert/Toast (L0) para resolverlo bien con useActionState; no se
  // resuelve acá para no cambiar el manejo de errores en un parche de
  // seguridad sin un error.tsx que lo sostenga.
  await supabase.rpc("cancel_booking", { p_booking_id: bookingId });
  revalidatePath("/me");
}

/**
 * "Liberar mi cupo" (ADR-0025): delega TODA la lógica en release_my_booking(),
 * que a su vez delega en cancel_booking() -- acá no se reimplementa ninguna
 * condición de emisión. Redirige con el resultado en la URL para que la
 * página pueda avisar "vence el DD/MM" cuando corresponda, en vez de
 * prometer el crédito antes de saber si la anticipación alcanzó.
 */
export async function releaseMyBooking(bookingId: string): Promise<void> {
  const supabase = await createClient();

  // Resuelta antes de cancelar (y no a partir de la respuesta de
  // release_my_booking, que solo trae organization_id, no el slug): esta
  // reserva liberada por sí sola desambigua a qué organización tiene que
  // volver /me para alguien con reservas en varias -- my_bookings() ya
  // arma organization_slug junto con organizationName, no hace falta una
  // consulta nueva. Se guarda antes del RPC para que el redirect de error
  // también pueda llevar `org=` (una reserva ajena o inexistente no
  // aparece acá, así que ese caso simplemente cae al fallback sin org).
  const bookings = await getMyBookings(true);
  const orgSlug = bookings.find((booking) => booking.bookingId === bookingId)?.organizationSlug;
  const orgParam = orgSlug ? `&org=${encodeURIComponent(orgSlug)}` : "";

  const { data, error } = await supabase.rpc("release_my_booking", { p_booking_id: bookingId });
  revalidatePath("/me");

  // Fase 25: antes esta llamada ignoraba el error y redirigía igual con
  // `liberado=1`. Una RPC que falla (reserva ajena, ya cancelada) le
  // decía al cliente que había liberado su cupo cuando no había pasado
  // nada -- el peor resultado posible para la acción que ADR-0025 hace
  // depender de haber avisado a tiempo. No se inventa un parámetro de
  // error nuevo (la pantalla es de frontend-engineer): simplemente se
  // deja de afirmar un éxito que no ocurrió.
  //
  // Fase 25 (frontend): `liberar_error=1` es ese parámetro. Sin él, "no
  // pasó nada" y "salió todo bien" se ven igual en /me -- la lista vuelve
  // a renderizar con la reserva intacta y sin una sola palabra. El motivo
  // exacto no viaja: la RPC falla por reserva ajena o ya cancelada, y
  // ninguna de las dos es algo que el cliente pueda accionar desde acá.
  if (error) {
    redirect(`/me?liberar_error=1${orgParam}`);
  }

  const credit = (data as { makeup_credit?: { id: string; expires_on: string } | null } | null)?.makeup_credit;
  redirect(
    credit
      ? `/me?liberado=1&credito_hasta=${encodeURIComponent(credit.expires_on)}${orgParam}`
      : `/me?liberado=1${orgParam}`,
  );
}

export interface MyMakeupCredit {
  creditId: string;
  organizationName: string;
  serviceName: string;
  origin: "CUSTOMER_RELEASE" | "ORGANIZATION_CANCELLED" | "MANUAL";
  status: "AVAILABLE" | "CONSUMED" | "REVOKED";
  issuedAt: string;
  expiresOn: string;
  isExpired: boolean;
  sourceStartAt: string | null;
}

/** ADR-0025: mis créditos de recupero, con is_expired ya calculado en SQL. */
export async function getMyMakeupCredits(): Promise<MyMakeupCredit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_makeup_credits");

  if (error || !data) return [];

  return data.map(
    (row: {
      credit_id: string;
      organization_name: string;
      service_name: string;
      origin: MyMakeupCredit["origin"];
      status: MyMakeupCredit["status"];
      issued_at: string;
      expires_on: string;
      is_expired: boolean;
      source_start_at: string | null;
    }) => ({
      creditId: row.credit_id,
      organizationName: row.organization_name,
      serviceName: row.service_name,
      origin: row.origin,
      status: row.status,
      issuedAt: row.issued_at,
      expiresOn: row.expires_on,
      isExpired: row.is_expired,
      sourceStartAt: row.source_start_at,
    }),
  );
}
