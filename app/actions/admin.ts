"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { DESK_BOOKING_REASONS } from "@/lib/booking-reasons";

// Every function here re-resolves the organization from its slug and
// re-checks membership server-side (requireOrganizationMembership), so no
// caller can act on an organization by passing its id. The RPCs behind
// them repeat the check in SQL -- this layer exists to turn a blocked
// query into a clean redirect, not to be the security boundary.

export interface AgendaOccurrence {
  id: string;
  serviceId: string;
  serviceName: string;
  resourceId: string;
  resourceName: string;
  startAt: string;
  endAt: string;
  capacity: number;
  confirmedCount: number;
  status: "ACTIVE" | "BLOCKED" | "CANCELLED";
}

export async function getAgenda(
  organizationSlug: string,
  from: Date,
  to: Date,
): Promise<AgendaOccurrence[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("agenda_occurrences", {
    p_organization_id: organization.id,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });

  if (error || !data) {
    return [];
  }

  return data.map(
    (row: {
      id: string;
      service_id: string;
      service_name: string;
      resource_id: string;
      resource_name: string;
      start_at: string;
      end_at: string;
      capacity: number;
      confirmed_count: number;
      status: AgendaOccurrence["status"];
    }) => ({
      id: row.id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      startAt: row.start_at,
      endAt: row.end_at,
      capacity: row.capacity,
      confirmedCount: row.confirmed_count,
      status: row.status,
    }),
  );
}

export interface OccurrenceAttendee {
  bookingId: string;
  customerId: string;
  customerName: string;
  status: "CONFIRMED" | "CANCELLED" | "NOT_GENERATED";
  /** Independent of status: reserved and absent is a normal case (ADR-0022). */
  attendanceStatus: "PENDING" | "PRESENT" | "ABSENT";
  attendanceMarkedAt: string | null;
  createdAt: string;
}

export async function getOccurrenceAttendees(
  organizationSlug: string,
  slotOccurrenceId: string,
): Promise<OccurrenceAttendee[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("occurrence_bookings", {
    p_slot_occurrence_id: slotOccurrenceId,
  });

  if (error || !data) {
    return [];
  }

  return data.map(
    (row: {
      booking_id: string;
      customer_id: string;
      customer_name: string;
      status: OccurrenceAttendee["status"];
      attendance_status: OccurrenceAttendee["attendanceStatus"];
      attendance_marked_at: string | null;
      created_at: string;
    }) => ({
      bookingId: row.booking_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      status: row.status,
      attendanceStatus: row.attendance_status,
      attendanceMarkedAt: row.attendance_marked_at,
      createdAt: row.created_at,
    }),
  );
}

export interface OrganizationCustomer {
  customerId: string;
  profileId: string;
  fullName: string;
  isActive: boolean;
  createdAt: string;
}

export async function getCustomers(organizationSlug: string): Promise<OrganizationCustomer[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("organization_customers", {
    p_organization_id: organization.id,
  });

  if (error || !data) {
    return [];
  }

  return data.map(
    (row: { customer_id: string; profile_id: string; full_name: string; is_active: boolean; created_at: string }) => ({
      customerId: row.customer_id,
      profileId: row.profile_id,
      fullName: row.full_name,
      isActive: row.is_active,
      createdAt: row.created_at,
    }),
  );
}

export interface TeamMember {
  memberId: string;
  profileId: string;
  fullName: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
}

export async function getTeam(organizationSlug: string): Promise<TeamMember[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("organization_team", {
    p_organization_id: organization.id,
  });

  if (error || !data) {
    return [];
  }

  return data.map(
    (row: { member_id: string; profile_id: string; full_name: string; role: TeamMember["role"]; is_active: boolean }) => ({
      memberId: row.member_id,
      profileId: row.profile_id,
      fullName: row.full_name,
      role: row.role,
      isActive: row.is_active,
    }),
  );
}

export interface ActionState {
  error: string | null;
  success: string | null;
}

/** Maps the RPC's raised exceptions to something a person can act on. */
function describeError(message: string | undefined): string {
  if (!message) return "Algo salió mal";
  if (message.includes("PROFILE_NOT_FOUND")) {
    return "No existe una cuenta con ese email. La persona tiene que registrarse primero.";
  }
  if (message.includes("NOT_AUTHORIZED")) return "No tenés permiso para hacer esto";
  if (message.includes("LAST_OWNER")) return "No podés quitar al último dueño de la organización";
  if (message.includes("CAPACITY_BELOW_ACTIVE_BOOKINGS")) {
    return "La capacidad no puede quedar por debajo de las reservas ya confirmadas";
  }
  return "Algo salió mal";
}

export async function enrollCustomer(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "El email es obligatorio", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("enroll_customer_by_email", {
    p_organization_id: organization.id,
    p_email: email,
  });

  if (error) {
    return { error: describeError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/customers`);
  return { error: null, success: `${email} quedó habilitado como cliente` };
}

export async function inviteMember(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const email = String(formData.get("email") ?? "").trim();
  const role = String(formData.get("role") ?? "STAFF");

  if (!email) {
    return { error: "El email es obligatorio", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member_by_email", {
    p_organization_id: organization.id,
    p_email: email,
    p_role: role,
  });

  if (error) {
    return { error: describeError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: `${email} se sumó como ${role === "OWNER" ? "dueño" : "equipo"}` };
}

// Plain <form action> targets: React requires these to resolve to void.
// A failure (e.g. LAST_OWNER) leaves the row unchanged and the
// revalidated page simply still shows the member -- acceptable here
// because the UI already hides the action when it can't apply. The forms
// that need to explain a failure use useActionState instead.
export async function revokeMember(organizationSlug: string, memberId: string): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("revoke_member", { p_member_id: memberId });
  revalidatePath(`/org/${organizationSlug}/team`);
}

export async function bookCustomerIntoSlot(
  organizationSlug: string,
  slotOccurrenceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrganizationMembership(organizationSlug);
  const customerId = String(formData.get("customerId") ?? "");

  if (!customerId) {
    return { error: "Elegí un cliente", success: null };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_book_for_customer", {
    p_slot_occurrence_id: slotOccurrenceId,
    p_customer_id: customerId,
  });

  if (error) {
    return { error: describeError(error.message), success: null };
  }

  const status = (data as { status: string }).status;
  if (status !== "OK") {
    // Built on the shared table so a reason code added in the database
    // can never come out as "no se pudo anotar al cliente"; the overrides
    // are the ones that read better as a full sentence in a form error.
    const reasons: Record<string, string> = {
      ...DESK_BOOKING_REASONS,
      SLOT_FULL: "El horario está completo",
      ALREADY_BOOKED: "Ese cliente ya está anotado",
      PAYMENT_REQUIRED: "El pago del cliente no cubre esta fecha",
      NOT_A_CUSTOMER: "Esa persona no es cliente de esta organización",
      OCCURRENCE_NOT_AVAILABLE: "Ese horario ya no está disponible",
      DUPLICATE: "Ese cliente ya está anotado",
      // ADR-0024: both mean the month is paid, so neither can say "falta
      // el pago" -- and their remedies are different from each other's.
      OUTSIDE_PLAN_QUOTA:
        "Su mes está pago, pero este turno no es uno de sus horarios fijos. Cobrale el turno aparte o sumalo a su plan.",
      OVER_PLAN_QUOTA:
        "Su plan no cubre otro horario fijo por semana. Cambialo a un plan con más frecuencia, o quitale otro horario.",
      SERVICE_HAS_NO_PLAN:
        "Este servicio exige pago y no tiene ningún plan activo. Creá uno en la pestaña Planes del servicio.",
    };
    return { error: reasons[status] ?? "No se pudo anotar al cliente", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/agenda`);
  return { error: null, success: "Cliente anotado" };
}

export async function cancelBookingAsStaff(organizationSlug: string, bookingId: string): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("cancel_booking", {
    p_booking_id: bookingId,
    p_reason: "CUSTOMER_REQUEST",
  });

  revalidatePath(`/org/${organizationSlug}/agenda`);
}

export async function cancelOccurrence(organizationSlug: string, slotOccurrenceId: string): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  // Cascades to cancel the confirmed bookings on it (Phase 5).
  await supabase.rpc("cancel_slot_occurrence", {
    p_slot_occurrence_id: slotOccurrenceId,
    p_reason: "SLOT_CANCELLED",
  });

  revalidatePath(`/org/${organizationSlug}/agenda`);
}

export async function updateOccurrenceCapacity(
  organizationSlug: string,
  slotOccurrenceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrganizationMembership(organizationSlug);
  const capacity = Number(formData.get("capacity"));

  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "La capacidad tiene que ser un número mayor a 0", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("slot_occurrences")
    .update({ capacity })
    .eq("id", slotOccurrenceId);

  if (error) {
    return { error: describeError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/agenda`);
  return { error: null, success: "Capacidad actualizada" };
}


export interface OccurrenceDetail extends AgendaOccurrence {
  present: number;
  absent: number;
  pending: number;
}

/**
 * One occurrence with its roll-call totals. Reads the same
 * agenda_occurrences RPC the calendar uses, so the capacity and confirmed
 * count on this screen can never disagree with the block you clicked
 * (the invariant of docs/domain.md: availability is derived, never
 * counted twice).
 */
export async function getOccurrence(
  organizationSlug: string,
  slotOccurrenceId: string,
): Promise<OccurrenceDetail | null> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("slot_occurrences")
    .select("start_at")
    .eq("id", slotOccurrenceId)
    .maybeSingle();
  if (!rows) return null;

  const at = new Date(rows.start_at);
  const occurrences = await getAgenda(
    organizationSlug,
    new Date(at.getTime() - 60_000),
    new Date(at.getTime() + 60_000),
  );
  const occurrence = occurrences.find((o) => o.id === slotOccurrenceId);
  if (!occurrence) return null;

  const { data: summary } = await supabase.rpc("occurrence_attendance_summary", {
    p_slot_occurrence_id: slotOccurrenceId,
  });
  const totals = summary?.[0] ?? { present: 0, absent: 0, pending: 0 };

  void organization;
  return {
    ...occurrence,
    present: totals.present,
    absent: totals.absent,
    pending: totals.pending,
  };
}

/** Roll call. <form action> target, so it resolves to void. */
export async function markAttendance(
  organizationSlug: string,
  slotOccurrenceId: string,
  bookingId: string,
  status: "PENDING" | "PRESENT" | "ABSENT",
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("mark_attendance", { p_booking_id: bookingId, p_status: status });
  revalidatePath(`/org/${organizationSlug}/agenda/${slotOccurrenceId}`, "layout");
}


export interface AttendanceHistoryEntry {
  slotOccurrenceId: string;
  startAt: string;
  endAt: string;
  reserved: number;
  present: number;
  absent: number;
  pending: number;
}

/** Past occurrences of a service with their roll-call totals (ADR-0023). */
export async function getServiceAttendanceHistory(
  organizationSlug: string,
  serviceId: string,
): Promise<AttendanceHistoryEntry[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("service_attendance_history", {
    p_service_id: serviceId,
    p_limit: 30,
  });
  if (error || !data) return [];

  return data.map(
    (row: {
      slot_occurrence_id: string;
      start_at: string;
      end_at: string;
      reserved: number;
      present: number;
      absent: number;
      pending: number;
    }) => ({
      slotOccurrenceId: row.slot_occurrence_id,
      startAt: row.start_at,
      endAt: row.end_at,
      reserved: row.reserved,
      present: row.present,
      absent: row.absent,
      pending: row.pending,
    }),
  );
}
