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

export async function getPublicAvailability(organizationSlug: string, serviceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_availability", {
    p_organization_slug: organizationSlug,
    p_service_id: serviceId,
  });

  if (error || !data) {
    return [];
  }

  return data.map(mapPublicAvailabilitySlot);
}
