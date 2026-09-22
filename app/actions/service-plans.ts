"use server";

import { revalidatePath } from "next/cache";
import {
  createServicePlanSchema,
  mapServicePlan,
  updateServicePlanSchema,
  type ServicePlan,
  type ServicePlanKind,
} from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { localDayKey } from "@/lib/calendar";
import type { ActionState } from "@/app/actions/admin";

// ServicePlan is the price list an Organization offers its Customers
// (ADR-0024) -- never public.plans, which are the SaaS tiers the
// organization itself pays.
//
// These are plain table writes: RLS gates them to organization members and
// every real rule (quota only on WEEKLY_QUOTA, one active DROP_IN per
// service, immutable terms once the plan has payments) is a CHECK, a unique
// index or a trigger in the migration. This layer validates to produce a
// good message and translates the database's error codes into Spanish; it
// is never the defence -- service_plans is writable through PostgREST.
//
// ADR-0029: a plan covers one, several, or all of the organization's
// services. `service_plans.service_id` is gone -- the covered set lives in
// `service_plan_services` (or is resolved live from
// `applies_to_all_services`). Creating a plan with an explicit selection
// needs both tables written in one transaction (validate_service_plan_scope()
// is a deferred constraint), so creation goes through the create_service_plan
// RPC instead of a plain insert -- same reasoning ADR-0004 already
// established for book_slot(): two separate `.from()` calls are two
// separate transactions.

/**
 * A plan plus the only fact the screen can't derive from the row: whether
 * anyone has paid for it. That's what makes `plan_kind` and `weekly_quota`
 * immutable (ADR-0024, resolution 5), so the form needs it to disable those
 * fields *and explain why* instead of letting the trigger reject the save.
 */
export interface ServicePlanWithUsage extends ServicePlan {
  /** Non-VOID payments anchored to this plan. */
  paymentCount: number;
}

export interface ServicePlanListResult {
  plans: ServicePlanWithUsage[];
  /** Non-null means the read failed -- an empty list would be a lie. */
  error: string | null;
}

/**
 * Every service_plan_services row for the given plans, plus the resolved
 * "all active services" set for any plan with applies_to_all_services --
 * there is no single PostgREST query that joins and aggregates this, so it
 * is fetched here once and attached to every mapServicePlan() call below.
 */
async function loadCoveredServiceIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  rows: { id: string; applies_to_all_services: boolean }[],
): Promise<Map<string, string[]>> {
  const covered = new Map<string, string[]>();

  const explicitIds = rows.filter((r) => !r.applies_to_all_services).map((r) => r.id);
  if (explicitIds.length > 0) {
    const { data } = await supabase
      .from("service_plan_services")
      .select("service_plan_id, service_id")
      .in("service_plan_id", explicitIds);
    for (const row of data ?? []) {
      const r = row as { service_plan_id: string; service_id: string };
      const list = covered.get(r.service_plan_id) ?? [];
      list.push(r.service_id);
      covered.set(r.service_plan_id, list);
    }
  }

  const allIds = rows.filter((r) => r.applies_to_all_services).map((r) => r.id);
  if (allIds.length > 0) {
    const { data } = await supabase
      .from("services")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("is_active", true);
    const activeIds = (data ?? []).map((s) => (s as { id: string }).id);
    for (const id of allIds) covered.set(id, activeIds);
  }

  return covered;
}

export async function listServicePlans(
  organizationSlug: string,
  serviceId: string,
): Promise<ServicePlanListResult> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  // A plan appears here if it names this service explicitly, or if it
  // applies to every service. Two queries: which plans link this service
  // (service_plan_services), then the plans themselves.
  const { data: linkRows, error: linkError } = await supabase
    .from("service_plan_services")
    .select("service_plan_id")
    .eq("service_id", serviceId);

  if (linkError) {
    return { plans: [], error: "No se pudieron cargar los planes" };
  }

  const linkedPlanIds = (linkRows ?? []).map((r) => (r as { service_plan_id: string }).service_plan_id);

  let query = supabase.from("service_plans").select("*").eq("organization_id", organization.id);
  query =
    linkedPlanIds.length > 0
      ? query.or(`applies_to_all_services.eq.true,id.in.(${linkedPlanIds.join(",")})`)
      : query.eq("applies_to_all_services", true);

  const { data, error } = await query
    .order("is_active", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) {
    return { plans: [], error: "No se pudieron cargar los planes" };
  }

  const coveredByPlan = await loadCoveredServiceIds(supabase, organization.id, data as never[]);
  const plans = data.map((row) => mapServicePlan(row as never, coveredByPlan.get((row as { id: string }).id) ?? []));
  const counts = await countPaymentsByPlan(
    supabase,
    organization.id,
    plans.map((plan) => plan.id),
  );

  return {
    plans: plans.map((plan) => ({ ...plan, paymentCount: counts[plan.id] ?? 0 })),
    error: null,
  };
}

/** Every plan of the organization, active or not -- used to label payments. */
export async function listOrganizationServicePlans(organizationSlug: string): Promise<ServicePlan[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_plans")
    .select("*")
    .eq("organization_id", organization.id)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const coveredByPlan = await loadCoveredServiceIds(supabase, organization.id, data as never[]);
  return data.map((row) => mapServicePlan(row as never, coveredByPlan.get((row as { id: string }).id) ?? []));
}

/**
 * What the front desk can charge today, with the period each plan buys
 * already resolved.
 *
 * The period comes from `billing_period_for(plan, date)` -- the same
 * function the rest of the system uses -- and not from arithmetic in the
 * browser: "paying on the 15th covers from the 1st" is a business rule, and
 * a second implementation of it in the client would drift (CLAUDE.md).
 * Resolving it here, once per plan, also means picking a plan prefills the
 * form with no round trip.
 *
 * `p_from` is the organization's local date, never the server's UTC one
 * (ADR-0013/ADR-0014): at 22:00 in Montevideo it is already tomorrow in
 * UTC, and at the end of a month that buys the wrong month.
 */
export interface PaymentPlanOption {
  id: string;
  /** ADR-0029: a plan can cover several services -- see mapServicePlan. */
  serviceIds: string[];
  name: string;
  planKind: ServicePlanKind;
  weeklyQuota: number | null;
  billingType: ServicePlan["billingType"];
  billingCycle: ServicePlan["billingCycle"];
  price: number;
  /** Period this plan buys if it is paid today, per billing_period_for(). */
  periodStart: string | null;
  periodEnd: string | null;
}

export async function listPaymentPlanOptions(organizationSlug: string): Promise<PaymentPlanOption[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_plans")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];

  const coveredByPlan = await loadCoveredServiceIds(supabase, organization.id, data as never[]);
  const today = localDayKey(new Date(), organization.timezone);

  return Promise.all(
    data
      .map((row) => mapServicePlan(row as never, coveredByPlan.get((row as { id: string }).id) ?? []))
      .map(async (plan) => {
        const { data: period } = await supabase.rpc("billing_period_for", {
          p_service_plan_id: plan.id,
          p_from: today,
        });

        const row = Array.isArray(period) ? period[0] : period;

        return {
          id: plan.id,
          serviceIds: plan.serviceIds,
          name: plan.name,
          planKind: plan.planKind,
          weeklyQuota: plan.weeklyQuota,
          billingType: plan.billingType,
          billingCycle: plan.billingCycle,
          price: plan.price,
          periodStart: row?.period_start ?? null,
          periodEnd: row?.period_end ?? null,
        };
      }),
  );
}

async function countPaymentsByPlan(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  planIds: string[],
): Promise<Record<string, number>> {
  if (planIds.length === 0) return {};

  const { data } = await supabase
    .from("payments")
    .select("service_plan_id")
    .eq("organization_id", organizationId)
    .in("service_plan_id", planIds)
    // A VOID payment doesn't freeze the terms: the trigger looks at
    // `status <> 'VOID'`, and this has to agree with it or the form
    // disables a field the database would have let through.
    .neq("status", "VOID");

  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { service_plan_id: string }).service_plan_id;
    counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

// Same rule the service's payment configuration already had: staff run the
// desk, the owner sets the prices. It is a product policy and not the
// security boundary -- RLS on service_plans admits any organization member
// -- so it is applied here and mirrored by hiding the controls, never
// assumed.
const OWNER_ONLY = "Solo el dueño puede cambiar los precios";

/** Turns the migration's constraint and trigger names into something readable. */
function describePlanError(message: string | undefined): string {
  const text = message ?? "";

  if (text.includes("SERVICE_PLAN_TERMS_IMMUTABLE")) {
    return "Este plan ya tiene pagos, así que no se puede cambiar qué da ni con qué frecuencia. Desactivalo y creá uno nuevo: a quien ya pagó no se le corta la cobertura.";
  }
  if (text.includes("SERVICE_NOT_PAYMENT_REQUIRED")) {
    return "Para vender turnos fijos por semana, el servicio tiene que exigir pago al día. Activalo en la configuración del servicio, en la pestaña Horarios.";
  }
  if (text.includes("SERVICE_PLAN_DROP_IN_ALREADY_EXISTS")) {
    return "Ya hay un plan de turno suelto activo en ese servicio. Desactivá el anterior antes de crear otro.";
  }
  if (text.includes("service_plans_active_name_idx")) {
    return "Ya tenés un plan activo con ese nombre en esta organización.";
  }
  if (text.includes("SERVICE_PLAN_SCOPE_EMPTY")) {
    return "Elegí al menos un servicio, o marcá que el plan cubre todos.";
  }
  if (text.includes("SERVICE_PLAN_SCOPE_EXCLUSIVE")) {
    return "Elegí servicios puntuales o todos los servicios, no las dos cosas.";
  }
  if (text.includes("service_plans_price_non_negative")) {
    return "El precio no puede ser negativo.";
  }
  if (text.includes("service_plans_quota_matches_kind")) {
    return "Un plan de turnos fijos necesita una frecuencia de al menos 1 por semana.";
  }
  if (text.includes("service_plans_quota_scope_matches_kind")) {
    return "Elegí cómo se reparte la cuota entre los servicios de este plan.";
  }
  if (text.includes("service_plans_billing_matches_kind")) {
    return "Esa combinación de tipo de plan y forma de cobro no está permitida.";
  }
  if (text.includes("NOT_AUTHORIZED")) {
    return OWNER_ONLY;
  }

  return "No se pudo guardar el plan";
}

function revalidatePlans(organizationSlug: string, serviceId: string): void {
  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/plans`);
  // A plan change moves what the payment screens can charge.
  revalidatePath(`/org/${organizationSlug}`, "layout");
}

export async function createServicePlan(
  organizationSlug: string,
  serviceId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") {
    return { error: OWNER_ONLY, success: null };
  }

  const planKind = String(formData.get("planKind") ?? "") as ServicePlanKind;

  // Scope (ADR-0029): "todos los servicios", or an explicit multi-select --
  // both mutually exclusive with the other, enforced by the database
  // (create_service_plan / validate_service_plan_scope). DROP_IN keeps the
  // pre-ADR-0029 single-service form: multi-service DROP_IN is out of scope
  // on purpose (it is the prepaid-package shape ADR-0022/0024 already
  // rejected).
  const appliesToAllServices = formData.get("appliesToAllServices") === "on";
  const serviceIds = appliesToAllServices
    ? []
    : planKind === "DROP_IN"
      ? [serviceId]
      : formData.getAll("serviceIds").map(String).filter(Boolean);

  const parsed = createServicePlanSchema.safeParse({
    appliesToAllServices,
    serviceIds,
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    price: formData.get("price"),
    planKind,
    // Only read for WEEKLY_QUOTA; the other two branches drop it.
    weeklyQuota: formData.get("weeklyQuota") || undefined,
    billingCycle: formData.get("billingCycle") || undefined,
    sortOrder: formData.get("sortOrder") || 0,
    quotaScope: formData.get("quotaScope") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }

  if (!appliesToAllServices && serviceIds.length === 0) {
    return { error: "Elegí al menos un servicio, o marcá que el plan cubre todos.", success: null };
  }

  const isQuota = planKind === "WEEKLY_QUOTA";
  const isOneTime = planKind === "DROP_IN";
  const billingCycle = String(formData.get("billingCycle") ?? "") || "CALENDAR_MONTH";

  // quota_scope only matters, and is only required, when the plan is
  // WEEKLY_QUOTA and covers more than one service (ADR-0029 §3) -- a
  // single-service quota plan defaults to PER_SERVICE, which is exactly
  // what it already meant before this ADR.
  const coversMultiple = appliesToAllServices || serviceIds.length > 1;
  const quotaScope = isQuota ? (coversMultiple ? parsed.data.quotaScope ?? "PER_SERVICE" : "PER_SERVICE") : null;

  if (isQuota && coversMultiple && !parsed.data.quotaScope) {
    return { error: "Elegí cómo se reparte la cuota entre los servicios de este plan.", success: null };
  }

  const supabase = await createClient();

  const { error } = await supabase.rpc("create_service_plan", {
    p_organization_id: organization.id,
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? null,
    p_price: parsed.data.price,
    p_plan_kind: planKind,
    p_weekly_quota: isQuota ? Number(formData.get("weeklyQuota")) : null,
    p_billing_type: isOneTime ? "ONE_TIME" : "MONTHLY",
    p_billing_cycle: isOneTime ? null : billingCycle,
    p_sort_order: parsed.data.sortOrder,
    p_applies_to_all_services: appliesToAllServices,
    p_service_ids: appliesToAllServices ? null : serviceIds,
    p_quota_scope: quotaScope,
  });

  if (error) {
    return { error: describePlanError(error.message), success: null };
  }

  revalidatePlans(organizationSlug, serviceId);
  return { error: null, success: "Plan creado" };
}

/**
 * Editing a plan. `plan_kind`, `weekly_quota` and the scope fields are
 * absent on purpose -- they are frozen in edit always (same pattern as
 * ADR-0024 resolution 5, extended by ADR-0029 §8 to the scope selection),
 * and immutable once the plan has non-VOID payments regardless. The price
 * *is* free to change: it only affects future charges, and every Payment
 * records the amount it was charged.
 */
export async function updateServicePlan(
  organizationSlug: string,
  serviceId: string,
  planId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") {
    return { error: OWNER_ONLY, success: null };
  }

  // `?? undefined` rather than the raw value: every field of the update
  // schema is optional, and a missing input arrives as null, which
  // z.coerce would happily read as 0 instead of "not sent".
  const parsed = updateServicePlanSchema.safeParse({
    name: formData.get("name") ?? undefined,
    description: formData.get("description") || null,
    price: formData.get("price") ?? undefined,
    sortOrder: formData.get("sortOrder") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos", success: null };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("service_plans")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      price: parsed.data.price,
      sort_order: parsed.data.sortOrder,
    })
    .eq("id", planId)
    .eq("organization_id", organization.id);

  if (error) {
    return { error: describePlanError(error.message), success: null };
  }

  revalidatePlans(organizationSlug, serviceId);
  return { error: null, success: "Plan actualizado" };
}

/**
 * Deactivating is the only way out: there is no DELETE policy on
 * `service_plans` and `payments.service_plan_id` is ON DELETE RESTRICT,
 * because a payment has to be able to resolve its own terms backwards
 * forever.
 *
 * It cuts nobody's coverage -- `payment_covers_slot()` reads `plan_kind`
 * without filtering by `is_active` (ADR-0024 §6.d). It only takes the plan
 * off the price list.
 *
 * `<form action>` target, so it returns void and reports through the page
 * instead of an ActionState.
 */
export async function setServicePlanActive(
  organizationSlug: string,
  serviceId: string,
  planId: string,
  isActive: boolean,
): Promise<void> {
  const { organization, membership } = await requireOrganizationMembership(organizationSlug);
  if (membership.role !== "OWNER") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // service_plans_cancellation_consistent: an active plan cannot carry a
  // cancelled_at, so reactivating has to clear both columns.
  await supabase
    .from("service_plans")
    .update(
      isActive
        ? { is_active: true, cancelled_at: null, cancelled_by: null }
        : { is_active: false, cancelled_at: new Date().toISOString(), cancelled_by: user?.id },
    )
    .eq("id", planId)
    .eq("organization_id", organization.id);

  revalidatePlans(organizationSlug, serviceId);
}
