"use server";

// Public/anonymous reads only -- no auth check, no organization
// membership required. Ref: docs/security.md (calendario público),
// ADR-0008. These call organizations_public/services_public/
// get_public_availability, never the base tables, so there is no private
// data (Customer, Booking, Payment, personal fields) these functions
// could possibly return even by mistake.

import type { BillingCycle, ServicePlanKind } from "@reservaste/domain";
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

/**
 * ADR-0051: `services_public` gained `has_dynamic_resource` (true when the
 * service has at least one `Resource` with `dynamic_availability` on). The
 * @reservaste/domain package this frontend depends on (separate repo, git
 * ref -- CLAUDE.md) hasn't been re-published with it yet, so it's hand-added
 * here on top of `mapPublicService()` -- same pattern as resourceId/
 * resourceName in `getPublicAvailability()` below.
 */
export type PublicServiceSummary = ReturnType<typeof mapPublicService> & {
  hasDynamicResource: boolean;
};

function mapPublicServiceSummary(
  row: Parameters<typeof mapPublicService>[0] & { has_dynamic_resource?: boolean | null },
): PublicServiceSummary {
  return { ...mapPublicService(row), hasDynamicResource: row.has_dynamic_resource ?? false };
}

export async function listPublicServices(organizationId: string): Promise<PublicServiceSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services_public")
    .select("*")
    .eq("organization_id", organizationId);

  if (error || !data) {
    return [];
  }

  return data.map(mapPublicServiceSummary);
}

/**
 * One public service by id, for a screen (ADR-0051's `/reservar-dinamico`)
 * that already knows which service it's about instead of browsing the
 * whole catalog. Same disclosure as `listPublicServices` (`services_public`,
 * no RLS bypass) -- just narrowed server-side instead of filtered in JS.
 */
export async function getPublicService(
  organizationId: string,
  serviceId: string,
): Promise<PublicServiceSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services_public")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("id", serviceId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return mapPublicServiceSummary(data);
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

  // ADR-0025 / ADR-0048: recently_released, resource_id and resource_name
  // are new in get_public_availability() and the @reservaste/domain package
  // this frontend depends on (a separate repo, fetched by git ref -- see
  // CLAUDE.md) has not been re-published with them yet. Mapped by hand here
  // instead of through mapPublicAvailabilitySlot() so these fields work
  // today; once the backend package is pushed and bumped, this can fold
  // back into the shared mapper.
  return data.map(
    (
      row: Parameters<typeof mapPublicAvailabilitySlot>[0] & {
        recently_released?: boolean | null;
        resource_id: string;
        resource_name?: string | null;
      },
    ) => ({
      ...mapPublicAvailabilitySlot(row),
      recentlyReleased: row.recently_released ?? null,
      resourceId: row.resource_id,
      // ADR-0048: null unless the organization opted into
      // `public_resource_names` -- the RPC already decided this, this is
      // just the hand mapping, never a disclosure rule of its own.
      resourceName: row.resource_name ?? null,
    }),
  );
}

/**
 * The price list a business publishes: its active ServicePlans, with the
 * services each one covers already resolved (ADR-0029's
 * `applies_to_all_services` included).
 *
 * Public on purpose, and no new disclosure: `service_plans_select_public`
 * (Phase 22) already lets anon read active plans straight off PostgREST.
 * What `public_service_plans()` adds is doing the covered-set resolution
 * in one place, against *active* services only -- the same union the
 * admin screen needs two queries and a Map to assemble here
 * (loadCoveredServiceIds in service-plans.ts), and which a client-side
 * version would get subtly wrong for a plan whose explicit selection
 * includes a service that was since deactivated.
 *
 * `serviceId` narrows it to the plans that cover that service: that's the
 * shape the OVER_PLAN_QUOTA / OUTSIDE_PLAN_QUOTA screens need, where the
 * person is standing in front of one service and wants to know what else
 * is on offer for it.
 *
 * Defined here rather than in @reservaste/domain on purpose: the domain
 * package is a separate repo consumed by git ref (CLAUDE.md), so adding a
 * type there would block this screen behind a publish + bump. Same call
 * PaymentPlanOption already made.
 */
export interface PublicServicePlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  /** ISO 4217 of the organization (ADR-0024) -- a plan has no currency. */
  currency: string;
  planKind: ServicePlanKind;
  /** Only on WEEKLY_QUOTA; null on DROP_IN/UNLIMITED. */
  weeklyQuota: number | null;
  quotaScope: "PER_SERVICE" | "SHARED_ACROSS_SERVICES" | null;
  billingType: "ONE_TIME" | "MONTHLY";
  /**
   * ADR-0031: cuatro valores posibles, no dos -- un plan puede cobrarse por
   * bloques de varios meses. Cuántos meses dura el bloque todavía no viaja
   * por `public_service_plans()` (el catálogo público no lo muestra), así
   * que un plan trimestral se ve acá con su precio de lista y sin el
   * "cada N meses": pendiente de un corte futuro.
   */
  billingCycle: BillingCycle | null;
  appliesToAllServices: boolean;
  serviceIds: string[];
  serviceNames: string[];
}

export async function listPublicServicePlans(
  organizationSlug: string,
  serviceId?: string | null,
): Promise<PublicServicePlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("public_service_plans", {
    p_organization_slug: organizationSlug,
    p_service_id: serviceId ?? null,
  });

  if (error || !data) return [];

  return data.map(
    (row: {
      plan_id: string;
      name: string;
      description: string | null;
      price: string | number;
      currency: string;
      plan_kind: ServicePlanKind;
      weekly_quota: number | null;
      quota_scope: PublicServicePlan["quotaScope"];
      billing_type: PublicServicePlan["billingType"];
      billing_cycle: PublicServicePlan["billingCycle"];
      applies_to_all_services: boolean;
      service_ids: string[] | null;
      service_names: string[] | null;
    }) => ({
      id: row.plan_id,
      name: row.name,
      description: row.description,
      price: Number(row.price),
      currency: row.currency,
      planKind: row.plan_kind,
      weeklyQuota: row.weekly_quota,
      quotaScope: row.quota_scope,
      billingType: row.billing_type,
      billingCycle: row.billing_cycle,
      appliesToAllServices: row.applies_to_all_services,
      serviceIds: row.service_ids ?? [],
      serviceNames: row.service_names ?? [],
    }),
  );
}
