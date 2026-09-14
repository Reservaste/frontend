"use server";

import { redirect } from "next/navigation";
import { createOrganizationSchema, mapOrganization, mapOrganizationMember } from "@reservaste/domain";
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
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ese slug ya está en uso, elegí otro" };
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

  return {
    organization: mapOrganization(organizationRow),
    membership: mapOrganizationMember(membershipRow),
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
