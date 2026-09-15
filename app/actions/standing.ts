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
  /** Of the dates that didn't confirm, how many are waiting on a payment. */
  upcomingUnpaid: number;
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

  return data.map(
    (row: {
      recurring_booking_id: string;
      customer_id: string;
      customer_name: string;
      status: StandingReservation["status"];
      created_at: string;
      upcoming_confirmed: number;
      upcoming_not_generated: number;
      upcoming_unpaid: number;
    }) => ({
      recurringBookingId: row.recurring_booking_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      status: row.status,
      createdAt: row.created_at,
      upcomingConfirmed: row.upcoming_confirmed,
      upcomingNotGenerated: row.upcoming_not_generated,
      upcomingUnpaid: row.upcoming_unpaid,
    }),
  );
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
 * ADR-0012: never commit a series without showing what it will produce.
 * The front desk sees which of the upcoming dates would actually confirm
 * (and why the others wouldn't) before anything is written.
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

export interface StandingActionState {
  error: string | null;
  success: string | null;
}

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
    return { error: "Elegí un cliente", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_create_recurring_booking", {
    p_schedule_rule_id: scheduleRuleId,
    p_customer_id: customerId,
  });

  if (error) {
    const message = error.message ?? "";
    if (message.includes("ALREADY_HAS_STANDING_RESERVATION")) {
      return { error: "Ese cliente ya tiene este horario fijo", success: null };
    }
    if (message.includes("NOT_A_CUSTOMER")) {
      return { error: "Esa persona no es cliente de esta organización", success: null };
    }
    if (message.includes("NOT_AUTHORIZED")) {
      return { error: "No tenés permiso para hacer esto", success: null };
    }
    return { error: "No se pudo crear el horario fijo", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);
  return { error: null, success: "Horario fijo asignado" };
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
