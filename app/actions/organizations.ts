"use server";

import { redirect } from "next/navigation";
import {
  createOrganizationSchema,
  mapMyOrganizationPermissions,
  mapOrganization,
  mapOrganizationMember,
  NO_ORG_PERMISSIONS,
  type MyOrganizationPermissionsRow,
} from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";

export interface CreateOrganizationState {
  error: string | null;
}

/**
 * Creates an Organization and grants the current user OWNER membership,
 * atomically, via the create_organization_with_owner RPC (see the Phase 1
 * migration). This is not a concurrency-critical path like booking, but the
 * two inserts must not be allowed to half-succeed -- an organization
 * without an owner is a broken state, so this always goes through the RPC
 * instead of two separate inserts from here.
 */
export async function createOrganization(
  _prevState: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  const inviteCode = String(formData.get("inviteCode") ?? "").trim();
  if (!inviteCode) {
    return { error: "Necesitás un código de invitación para crear una organización" };
  }

  const parsed = createOrganizationSchema.safeParse({
    slug: formData.get("slug"),
    name: formData.get("name"),
    timezone: formData.get("timezone") || "America/Montevideo",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("create_organization_with_owner", {
    p_slug: parsed.data.slug,
    p_name: parsed.data.name,
    p_timezone: parsed.data.timezone,
    p_invite_code: inviteCode,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese slug ya está en uso, elegí otro" };
    }
    // The invite failures are the ones a buyer can actually act on, so
    // each gets its own wording instead of a generic failure.
    const message = error.message ?? "";
    // Phase 27/27b: the CHECKs on organizations.slug are the real boundary;
    // Zod normally catches both first, but a stale @reservaste/domain (or a
    // new reserved route added in SQL before the package bump) lands here.
    if (message.includes("SLUG_RESERVED")) {
      return { error: "Ese nombre está reservado, elegí otro" };
    }
    if (message.includes("INVALID_SLUG")) {
      return { error: "Solo minúsculas, números y guiones (ej: iron-gym)" };
    }
    if (message.includes("INVITE_NOT_FOUND")) {
      return { error: "Ese código no existe. Revisá que esté bien escrito." };
    }
    if (message.includes("INVITE_ALREADY_USED")) {
      return { error: "Ese código ya se usó para crear otra organización." };
    }
    if (message.includes("INVITE_EXPIRED")) {
      return { error: "Ese código venció. Pedí uno nuevo." };
    }
    if (message.includes("INVITE_WRONG_EMAIL")) {
      return { error: "Ese código está reservado para otra cuenta de email." };
    }
    return { error: "No se pudo crear la organización" };
  }

  const org = mapOrganization(data);
  redirect(`/dashboard?org=${org.slug}`);
}

/**
 * Resolves an Organization by slug and verifies the current user is an
 * active OWNER/STAFF member of it, in one step -- every org-scoped admin
 * page/action calls this instead of trusting a client-supplied
 * organizationId, so membership is always re-checked server-side (RLS is
 * the real enforcement, this is what turns a blocked query into a clean
 * redirect instead of a confusing empty page).
 *
 * ADR-0033: devuelve además `permissions`, los cinco permisos del rol
 * configurable ya resueltos (rol propio, o el rol por defecto de la
 * organización; un OWNER siempre los tiene todos). Es el único punto por
 * donde pasan todas las pantallas del panel, así que es el lugar natural
 * para que cada una decida qué esconder. Esconder NO es autorizar: la
 * autorización está en RLS y en cada RPC, y esto sirve para no
 * mostrar-todo-y-fallar-al-guardar.
 *
 * Si la RPC fallara, se devuelve NO_ORG_PERMISSIONS: se falla cerrado, y la
 * pantalla queda vacía en vez de ofrecer botones que la base va a rechazar.
 */
export async function requireOrganizationMembership(slug: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: orgRow, error: orgError } = await supabase
    .from("organizations")
    .select("*, organization_members!inner(*)")
    .eq("slug", slug)
    .eq("organization_members.profile_id", user.id)
    .eq("organization_members.is_active", true)
    .maybeSingle();

  if (orgError || !orgRow) {
    redirect("/dashboard");
  }

  const { organization_members, ...organizationRow } = orgRow;
  const membershipRow = Array.isArray(organization_members) ? organization_members[0] : organization_members;
  const membership = mapOrganizationMember(membershipRow);

  const { data: permissionRows } = await supabase.rpc("my_organization_permissions", {
    p_organization_id: organizationRow.id,
  });

  const permissionRow = (permissionRows as MyOrganizationPermissionsRow[] | null)?.[0];
  const resolved = permissionRow ? mapMyOrganizationPermissions(permissionRow) : null;

  return {
    organization: mapOrganization(organizationRow),
    membership,
    /** ADR-0033. Nombre del rol efectivo, null para un OWNER. */
    roleName: resolved?.roleName ?? null,
    permissions: resolved
      ? {
          canViewPayments: resolved.canViewPayments,
          canManagePayments: resolved.canManagePayments,
          canManageBookings: resolved.canManageBookings,
          canManageCustomers: resolved.canManageCustomers,
          canManageAttendance: resolved.canManageAttendance,
        }
      : NO_ORG_PERMISSIONS,
  };
}

/** Organizations where the current user is an active OWNER/STAFF member. */
export async function getMyOrganizations() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("*, organizations(*)")
    .eq("profile_id", user.id)
    .eq("is_active", true);

  if (error || !data) {
    return [];
  }

  return data.map((row) => ({
    membership: mapOrganizationMember(row),
    organization: mapOrganization(row.organizations),
  }));
}
