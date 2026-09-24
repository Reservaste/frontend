"use server";

import { revalidatePath } from "next/cache";
import {
  mapOrganizationTeamMember,
  type OrganizationTeamMemberRow,
} from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { DESK_BOOKING_REASONS } from "@/lib/booking-reasons";
import { siteUrl } from "@/lib/site-url";
import { buildWhatsAppActivationLink } from "@/lib/whatsapp-activation-link";

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

export interface AgendaOccurrenceWithAttendance extends AgendaOccurrence {
  presentCount: number;
  absentCount: number;
  pendingCount: number;
}

/**
 * Same window/rows as getAgenda(), plus roll-call totals per occurrence --
 * built for the organization home page ("próximas 24 horas"), which needs
 * to say at a glance which occurrences still have attendance pending
 * without duplicating the agenda_occurrences query or the
 * occurrence_attendance_summary call that getOccurrence() already does for
 * the single-occurrence case.
 */
export async function getAgendaWithAttendance(
  organizationSlug: string,
  from: Date,
  to: Date,
): Promise<AgendaOccurrenceWithAttendance[]> {
  const occurrences = await getAgenda(organizationSlug, from, to);
  if (occurrences.length === 0) return [];

  const supabase = await createClient();
  const summaries = await Promise.all(
    occurrences.map((occurrence) =>
      supabase.rpc("occurrence_attendance_summary", { p_slot_occurrence_id: occurrence.id }),
    ),
  );

  return occurrences.map((occurrence, i) => {
    const totals = summaries[i].data?.[0] as
      | { present: number; absent: number; pending: number }
      | undefined;
    return {
      ...occurrence,
      presentCount: totals?.present ?? 0,
      absentCount: totals?.absent ?? 0,
      pendingCount: totals?.pending ?? 0,
    };
  });
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
  /** Null for a managed customer (ADR-0026) -- exists, agendable, no session. */
  profileId: string | null;
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
    (row: { customer_id: string; profile_id: string | null; full_name: string; is_active: boolean; created_at: string }) => ({
      customerId: row.customer_id,
      profileId: row.profile_id,
      fullName: row.full_name,
      isActive: row.is_active,
      createdAt: row.created_at,
    }),
  );
}

/** ADR-0026: alta de un cliente sin cuenta (nombre + teléfono). */
/**
 * `whatsappUrl` set means: skip the trip through the customer's own page
 * to find "enviar activación" -- the form can put the send button right
 * here. Absent means either the phone was skipped or issuing the token
 * failed after the customer was already created (a soft error, not a
 * blocking one: the customer exists either way).
 */
export interface ManagedCustomerState extends ActionState {
  whatsappUrl?: string;
}

export async function createManagedCustomer(
  organizationSlug: string,
  _prev: ManagedCustomerState,
  formData: FormData,
): Promise<ManagedCustomerState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const displayName = String(formData.get("displayName") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();

  if (!displayName) {
    return { error: "El nombre es obligatorio", success: null };
  }
  if (!phone) {
    // Required now, not optional: the point of this screen is to go
    // straight to sending the WhatsApp link, and issueCustomerActivation
    // below refuses without one anyway.
    return { error: "El teléfono es obligatorio para poder mandarle el link de WhatsApp", success: null };
  }

  const supabase = await createClient();
  const { data: customerRow, error } = await supabase.rpc("create_managed_customer", {
    p_organization_id: organization.id,
    p_display_name: displayName,
    p_phone: phone,
  });

  if (error || !customerRow) {
    return { error: describeError(error?.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/customers`);

  // Issue the activation in the same round trip -- "ya de una", per the
  // request, instead of leaving the owner to open the customer afterward
  // just to find this same button (reuses issueCustomerActivation as-is,
  // so there is one place that builds this link, not two).
  const activationResult = await issueCustomerActivation(organizationSlug, (customerRow as { id: string }).id);
  if (activationResult.error || !activationResult.activation) {
    return {
      error: null,
      success: `${displayName} quedó habilitado como cliente, pero no se pudo generar el link de WhatsApp: ${activationResult.error ?? "error desconocido"}. Podés reintentarlo desde su ficha.`,
    };
  }

  return {
    error: null,
    success: `${displayName} quedó habilitado como cliente`,
    whatsappUrl: activationResult.activation.whatsappUrl,
  };
}

export interface CustomerActivationStatus {
  activationId: string;
  phone: string;
  createdAt: string;
  expiresAt: string;
  redeemedAt: string | null;
  revokedAt: string | null;
}

/** ADR-0026 Sec 5.2: the only door onto customer_activations -- never returns token_hash. */
export async function getCustomerActivationStatus(
  organizationSlug: string,
  customerId: string,
): Promise<CustomerActivationStatus | null> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("customer_activation_status", {
    p_customer_id: customerId,
  });
  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    activationId: row.activation_id,
    phone: row.phone,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    redeemedAt: row.redeemed_at,
    revokedAt: row.revoked_at,
  };
}

export interface IssuedActivation {
  expiresAt: string;
  /**
   * Ready-to-open api.whatsapp.com deep link, built server-side (organization
   * name + siteUrl() never trusted from the client). The token exists in
   * this URL exactly once -- it is not returned separately, not persisted,
   * not logged (ADR-0026 Sec 2.2/5.3).
   */
  whatsappUrl: string;
}

/** ADR-0026: emits (or reissues) the token and returns a ready WhatsApp link. */
export async function issueCustomerActivation(
  organizationSlug: string,
  customerId: string,
): Promise<{ activation: IssuedActivation | null; error: string | null }> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data: customerRow } = await supabase
    .from("customers")
    .select("phone")
    .eq("id", customerId)
    .maybeSingle();

  if (!customerRow?.phone) {
    return { activation: null, error: "Cargale un teléfono a este cliente antes de mandarle el link" };
  }

  const { data, error } = await supabase.rpc("issue_customer_activation", {
    p_customer_id: customerId,
  });

  if (error || !data || data.length === 0) {
    return { activation: null, error: describeError(error?.message) };
  }

  const row = data[0];
  const activationUrl = `${siteUrl()}/activar/${row.token as string}`;
  const whatsappUrl = buildWhatsAppActivationLink({
    phone: customerRow.phone as string,
    organizationName: organization.name,
    activationUrl,
  });

  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
  return { activation: { expiresAt: row.expires_at as string, whatsappUrl }, error: null };
}

export async function revokeCustomerActivation(
  organizationSlug: string,
  customerId: string,
  activationId: string,
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("revoke_customer_activation", { p_activation_id: activationId });
  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
}

export interface TeamMember {
  memberId: string;
  profileId: string;
  fullName: string;
  role: "OWNER" | "STAFF";
  isActive: boolean;
  /**
   * ADR-0033: el rol configurable EFECTIVO del miembro -- el asignado, o el
   * rol por defecto de la organización cuando no tiene uno. Null para un
   * OWNER, que no lleva rol configurable.
   */
  roleId: string | null;
  roleName: string | null;
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

  return (data as OrganizationTeamMemberRow[]).map(mapOrganizationTeamMember);
}

export interface ActionState {
  error: string | null;
  success: string | null;
}

/** Maps the RPC's raised exceptions to something a person can act on. */
function describeError(message: string | undefined): string {
  if (!message) return "Algo salió mal";
  if (message.includes("PROFILE_NOT_FOUND")) {
    return "No existe una cuenta con ese email. Si todavía no se registró, cerrá esto y usá \"Cliente sin cuenta\" en vez de esperar a que lo haga.";
  }
  if (message.includes("NOT_AUTHORIZED")) return "No tenés permiso para hacer esto";
  if (message.includes("LAST_OWNER")) return "No podés quitar al último dueño de la organización";
  if (message.includes("CAPACITY_BELOW_ACTIVE_BOOKINGS")) {
    return "La capacidad no puede quedar por debajo de las reservas ya confirmadas";
  }
  // ADR-0026
  if (message.includes("DISPLAY_NAME_REQUIRED")) return "El nombre es obligatorio";
  if (message.includes("INVALID_PHONE")) return "Ese teléfono no parece válido";
  if (message.includes("ACTIVATION_DISABLED")) {
    return "Esta organización tiene desactivada la activación por WhatsApp";
  }
  if (message.includes("CUSTOMER_INACTIVE")) return "Ese cliente está inactivo";
  if (message.includes("ALREADY_ACTIVATED")) return "Ese cliente ya tiene cuenta propia";
  if (message.includes("CUSTOMER_HAS_NO_PHONE")) {
    return "Cargale un teléfono a este cliente antes de mandarle el link";
  }
  if (message.includes("RATE_LIMITED")) {
    return "Se emitieron demasiados links en poco tiempo. Esperá un momento y probá de nuevo.";
  }
  if (message.includes("BOOKING_NOT_FOUND")) return "Esa reserva ya no existe";
  if (message.includes("BOOKING_NOT_CONFIRMED")) {
    return "No se puede marcar asistencia de una reserva cancelada";
  }
  // ADR-0033
  if (message.includes("ROLE_NAME_TAKEN")) return "Ya existe un rol con ese nombre";
  if (message.includes("ROLE_NAME_TOO_LONG")) return "El nombre del rol es demasiado largo";
  if (message.includes("ROLE_NAME_REQUIRED")) return "El nombre del rol es obligatorio";
  if (message.includes("MANAGE_PAYMENTS_REQUIRES_VIEW")) {
    return "Un rol que registra pagos tiene que poder verlos";
  }
  if (message.includes("ROLE_IN_USE")) {
    return "Ese rol todavía lo tiene alguien del equipo. Cambiale el rol primero.";
  }
  if (message.includes("DEFAULT_ROLE_REQUIRED")) {
    return "Tiene que haber siempre un rol por defecto. Elegí otro antes de sacar éste.";
  }
  if (message.includes("ROLE_INACTIVE")) return "Ese rol está desactivado";
  if (message.includes("ROLE_OTHER_ORGANIZATION")) return "Ese rol es de otra organización";
  if (message.includes("OWNER_HAS_NO_ROLE")) {
    return "El dueño no lleva rol: siempre puede todo";
  }
  if (message.includes("ROLE_NOT_FOUND")) return "Ese rol ya no existe";
  if (message.includes("MEMBER_NOT_FOUND")) return "Esa persona ya no está en el equipo";
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
  // ADR-0033: rol configurable del invitado. Vacío = el rol por defecto de
  // la organización (que es lo que hacía esta invitación antes). Un OWNER
  // nunca lleva rol: la RPC lo ignora aunque llegue.
  const roleId = String(formData.get("roleId") ?? "").trim() || null;

  if (!email) {
    return { error: "El email es obligatorio", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_member_by_email", {
    p_organization_id: organization.id,
    p_email: email,
    p_role: role,
    p_role_id: role === "OWNER" ? null : roleId,
  });

  if (error) {
    // The shared PROFILE_NOT_FOUND text points at "Cliente sin cuenta",
    // which is the customer flow. For the team the way out is ADR-0034's
    // invitation link.
    if (error.message.includes("PROFILE_NOT_FOUND")) {
      return {
        error:
          "No encontramos una cuenta con ese email. Si todavía no se registró, cerrá esto y usá “Invitar al equipo”: le llega un link por WhatsApp.",
        success: null,
      };
    }
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
        "Este servicio exige pago y no tiene ningún plan activo. Creá uno en Planes y elegí este servicio en su alcance.",
    };
    return { error: reasons[status] ?? "No se pudo anotar al cliente", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/agenda`);
  // ADR-0025: the desk sees, after the fact, whether this seat was
  // covered by a makeup credit instead of a payment -- same pattern as
  // lib/booking-reasons.ts, worded for the counter rather than the client.
  const makeupCreditId = (data as { makeup_credit_id?: string | null }).makeup_credit_id;
  return {
    error: null,
    success: makeupCreditId ? "Cliente anotado (con su crédito de recupero)" : "Cliente anotado",
  };
}

export interface CustomerMakeupCredit {
  creditId: string;
  serviceName: string;
  origin: "CUSTOMER_RELEASE" | "ORGANIZATION_CANCELLED" | "MANUAL";
  status: "AVAILABLE" | "CONSUMED" | "REVOKED";
  issuedAt: string;
  expiresOn: string;
  isExpired: boolean;
  note: string | null;
}

/** ADR-0025: the credits of one customer, for the counter's own view. */
export async function getCustomerMakeupCredits(
  organizationSlug: string,
  customerId: string,
): Promise<CustomerMakeupCredit[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("organization_customer_makeup_credits", {
    p_customer_id: customerId,
  });

  if (error || !data) return [];

  return data.map(
    (row: {
      credit_id: string;
      service_name: string;
      origin: CustomerMakeupCredit["origin"];
      status: CustomerMakeupCredit["status"];
      issued_at: string;
      expires_on: string;
      is_expired: boolean;
      note: string | null;
    }) => ({
      creditId: row.credit_id,
      serviceName: row.service_name,
      origin: row.origin,
      status: row.status,
      issuedAt: row.issued_at,
      expiresOn: row.expires_on,
      isExpired: row.is_expired,
      note: row.note,
    }),
  );
}

/** ADR-0025 resolución 5: crédito de cortesía, OWNER-only, auditado con nota. */
export async function grantManualMakeupCredit(
  organizationSlug: string,
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const serviceId = String(formData.get("serviceId") ?? "");
  const expiresOn = String(formData.get("expiresOn") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!serviceId || !expiresOn || !note.trim()) {
    return { error: "Completá el servicio, el vencimiento y el motivo", success: null };
  }

  const { error } = await supabase.rpc("grant_manual_makeup_credit", {
    p_customer_id: customerId,
    p_service_id: serviceId,
    p_expires_on: expiresOn,
    p_note: note,
  });

  if (error) {
    return {
      error: error.message.includes("NOT_AUTHORIZED")
        ? "Sólo el dueño de la organización puede otorgar créditos manuales"
        : "No se pudo otorgar el crédito",
      success: null,
    };
  }

  revalidatePath(`/org/${organizationSlug}/customers`);
  return { error: null, success: "Crédito otorgado" };
}

export async function cancelBookingAsStaff(organizationSlug: string, bookingId: string): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  // Phase 19 (ADR-0025 resolución 1): cancel_booking ya no acepta el motivo
  // del caller. El mostrador cancelando por el cliente sigue siendo
  // CUSTOMER_REQUEST -- cancelled_by (el staff) ya distingue quién ejecutó.
  //
  // TODO(Fase L): sin manejo de error visible para el staff -- mismo caso
  // que cancelMyBooking en app/actions/customer.ts.
  await supabase.rpc("cancel_booking", { p_booking_id: bookingId });

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

/** Roll call. */
export async function markAttendance(
  organizationSlug: string,
  slotOccurrenceId: string,
  bookingId: string,
  status: "PENDING" | "PRESENT" | "ABSENT",
): Promise<{ error: string | null }> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_attendance", { p_booking_id: bookingId, p_status: status });

  if (error) {
    return { error: describeError(error.message) };
  }

  revalidatePath(`/org/${organizationSlug}/agenda/${slotOccurrenceId}`, "layout");
  return { error: null };
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
