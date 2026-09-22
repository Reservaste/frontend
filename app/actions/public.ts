"use server";

// Public/anonymous reads only -- no auth check, no organization
// membership required. Ref: docs/security.md (calendario público),
// ADR-0008. These call organizations_public/services_public/
// get_public_availability, never the base tables, so there is no private
// data (Customer, Booking, Payment, personal fields) these functions
// could possibly return even by mistake.

import { mapPublicAvailabilitySlot, mapPublicOrganization, mapPublicService } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";

export async function getPublicOrganization(slug: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.from("organizations_public").select("*").eq("slug", slug).maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPublicOrganization(data);
}

export async function listPublicServices(organizationId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services_public")
    .select("*")
    .eq("organization_id", organizationId);

  if (error || !data) {
    return [];
  }

  return data.map(mapPublicService);
}

export async function getPublicAvailability(
  organizationSlug: string,
  serviceId?: string | null,
  from?: Date,
  to?: Date,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_availability", {
    p_organization_slug: organizationSlug,
    // Null means every service: the public calendar shows them together
    // and filters client-side (ADR-0023).
    p_service_id: serviceId ?? null,
    ...(from ? { p_from: from.toISOString() } : {}),
    ...(to ? { p_to: to.toISOString() } : {}),
  });

  if (error || !data) {
    return [];
  }

  // ADR-0025: recently_released is new in get_public_availability() and
  // the @reservaste/domain package this frontend depends on (a separate
  // repo, fetched by git ref -- see CLAUDE.md) has not been re-published
  // with it yet. Mapped by hand here instead of through
  // mapPublicAvailabilitySlot() so the badge works today; once the
  // backend package is pushed and bumped, this can fold back into the
  // shared mapper.
  return data.map((row: Parameters<typeof mapPublicAvailabilitySlot>[0] & { recently_released?: boolean | null }) => ({
    ...mapPublicAvailabilitySlot(row),
    recentlyReleased: row.recently_released ?? null,
  }));
}
