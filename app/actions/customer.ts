"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { NotGeneratedReason } from "@reservaste/domain";
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
  serviceName: string;
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
      service_name: string;
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
      serviceName: row.service_name,
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
  billingType: "FREE" | "ONE_TIME" | "MONTHLY";
  billingCycle: "CALENDAR_MONTH" | "ROLLING_MONTH" | null;
  price: number | null;
  paymentRequired: boolean;
  coveredUntil: string | null;
  isCoveredToday: boolean;
}

/**
 * The services the customer can book, and whether their month is covered
 * (ADR-0022). Replaces the entitlement list: nobody enables a service for
 * a person any more, so there is nothing per-person to show except
 * whether payment is up to date.
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
      billing_type: MyService["billingType"];
      billing_cycle: MyService["billingCycle"];
      price: string | number | null;
      payment_required: boolean;
      covered_until: string | null;
      is_covered_today: boolean;
    }) => ({
      serviceId: row.service_id,
      serviceName: row.service_name,
      organizationSlug: row.organization_slug,
      organizationName: row.organization_name,
      billingType: row.billing_type,
      billingCycle: row.billing_cycle,
      price: row.price === null ? null : Number(row.price),
      paymentRequired: row.payment_required,
      coveredUntil: row.covered_until,
      isCoveredToday: row.is_covered_today,
    }),
  );
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
  | "ALREADY_BOOKED";

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
  redirect("/me?reservado=1");
}

export async function cancelMyBooking(bookingId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("cancel_booking", { p_booking_id: bookingId, p_reason: "CUSTOMER_REQUEST" });
  revalidatePath("/me");
}
