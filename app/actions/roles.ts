"use server";

import { revalidatePath } from "next/cache";
import {
  createOrganizationRoleSchema,
  mapOrganizationRole,
  setMemberRoleSchema,
  updateOrganizationRoleSchema,
  type OrganizationRole,
  type OrganizationRoleRow,
} from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";

// ADR-0033 -- roles configurables por organización.
//
// Todo lo de acá es OWNER-only, y lo es EN LA BASE: las policies
// organization_roles_write_owner y cada RPC de esta familia chequean
// is_organization_owner(). El `membership.role !== "OWNER"` que aparece
// abajo existe para dar un mensaje decente, no para autorizar -- el
// proyecto ya aprendió en ADR-0028 que lo que no está en la base no está.
//
// Administrar roles NO es un permiso configurable a propósito: si lo
// fuera, existiría un rol capaz de ampliarse a sí mismo y los cinco
// permisos no significarían nada.

const OWNER_ONLY: ActionState = {
  error: "Solo el dueño puede administrar los roles del equipo",
  success: null,
};

/** Maps the RPC's raised exceptions to something a person can act on. */
function describeRoleError(message: string | undefined): string {
  if (!message) return "Algo salió mal";
  if (message.includes("NOT_AUTHORIZED")) return "No tenés permiso para hacer esto";
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
  if (message.includes("OWNER_HAS_NO_ROLE")) return "El dueño no lleva rol: siempre puede todo";
  if (message.includes("ROLE_NOT_FOUND")) return "Ese rol ya no existe";
  if (message.includes("MEMBER_NOT_FOUND")) return "Esa persona ya no está en el equipo";
  return "Algo salió mal";
}

/**
 * Los roles de la organización. Lectura para cualquier miembro (la pantalla
 * de equipo muestra el nombre del rol de cada uno), escritura sólo OWNER.
 */
export async function getOrganizationRoles(organizationSlug: string): Promise<OrganizationRole[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("organization_roles")
    .select("*")
    .eq("organization_id", organization.id)
    .order("is_default", { ascending: false })
    .order("name", { ascending: true });

  if (error || !data) return [];
  return (data as OrganizationRoleRow[]).map(mapOrganizationRole);
}

export async function createOrganizationRole(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return OWNER_ONLY;

  const parsed = createOrganizationRoleSchema.safeParse({
    name: formData.get("name"),
    canViewPayments: formData.get("canViewPayments") === "on",
    canManagePayments: formData.get("canManagePayments") === "on",
    canManageBookings: formData.get("canManageBookings") === "on",
    canManageCustomers: formData.get("canManageCustomers") === "on",
    canManageAttendance: formData.get("canManageAttendance") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organization_role", {
    p_organization_id: organization.id,
    p_name: parsed.data.name,
    p_can_view_payments: parsed.data.canViewPayments,
    p_can_manage_payments: parsed.data.canManagePayments,
    p_can_manage_bookings: parsed.data.canManageBookings,
    p_can_manage_customers: parsed.data.canManageCustomers,
    p_can_manage_attendance: parsed.data.canManageAttendance,
  });

  if (error) {
    return { error: describeRoleError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: `Rol "${parsed.data.name}" creado` };
}

export async function updateOrganizationRole(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return OWNER_ONLY;

  // Los booleanos de un <form> llegan sólo cuando están tildados, así que
  // acá SIEMPRE se mandan los cinco (nunca parcial desde el formulario de
  // edición): un checkbox ausente significa "apagado", no "no lo toques".
  const parsed = updateOrganizationRoleSchema.safeParse({
    roleId: formData.get("roleId"),
    name: formData.get("name") ?? undefined,
    canViewPayments: formData.get("canViewPayments") === "on",
    canManagePayments: formData.get("canManagePayments") === "on",
    canManageBookings: formData.get("canManageBookings") === "on",
    canManageCustomers: formData.get("canManageCustomers") === "on",
    canManageAttendance: formData.get("canManageAttendance") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_role", {
    p_role_id: parsed.data.roleId,
    p_name: parsed.data.name ?? null,
    p_can_view_payments: parsed.data.canViewPayments ?? null,
    p_can_manage_payments: parsed.data.canManagePayments ?? null,
    p_can_manage_bookings: parsed.data.canManageBookings ?? null,
    p_can_manage_customers: parsed.data.canManageCustomers ?? null,
    p_can_manage_attendance: parsed.data.canManageAttendance ?? null,
    p_is_active: parsed.data.isActive ?? null,
  });

  if (error) {
    return { error: describeRoleError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: "Rol actualizado" };
}

/**
 * Mueve el rol por defecto. Va por RPC y no por dos updates desde acá
 * porque son dos statements que tienen que ir en la misma transacción
 * (mismo razonamiento de ADR-0004: dos `.from()` son dos transacciones).
 */
export async function setOrganizationRoleDefault(
  organizationSlug: string,
  roleId: string,
): Promise<ActionState> {
  const { membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return OWNER_ONLY;

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_organization_role_default", { p_role_id: roleId });

  if (error) {
    return { error: describeRoleError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: "Rol por defecto actualizado" };
}

/** Desactiva un rol. Falla con ROLE_IN_USE si todavía lo tiene alguien. */
export async function deactivateOrganizationRole(
  organizationSlug: string,
  roleId: string,
): Promise<ActionState> {
  const { membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return OWNER_ONLY;

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_organization_role", {
    p_role_id: roleId,
    p_is_active: false,
  });

  if (error) {
    return { error: describeRoleError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: "Rol desactivado" };
}

/** Asigna (o quita, con roleId null) el rol configurable de un miembro. */
export async function setMemberRole(
  organizationSlug: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return OWNER_ONLY;

  const parsed = setMemberRoleSchema.safeParse({
    memberId: formData.get("memberId"),
    roleId: String(formData.get("roleId") ?? "").trim() || null,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_member_role", {
    p_member_id: parsed.data.memberId,
    p_role_id: parsed.data.roleId,
  });

  if (error) {
    return { error: describeRoleError(error.message), success: null };
  }

  revalidatePath(`/org/${organizationSlug}/team`);
  return { error: null, success: "Rol asignado" };
}
