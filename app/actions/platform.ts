"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

// Every function here is gated in SQL (is_platform_admin() / membership
// checks inside the RPCs). Nothing in this file is the security boundary.

export interface PlanUsage {
  planCode: string | null;
  planName: string | null;
  monthlyPriceUsd: number | null;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  servicesUsed: number;
  servicesLimit: number | null;
  resourcesUsed: number;
  resourcesLimit: number | null;
  customersUsed: number;
  customersLimit: number | null;
  teamUsed: number;
  teamLimit: number | null;
}

export async function getPlanUsage(organizationSlug: string): Promise<PlanUsage | null> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("organization_usage", {
    p_organization_id: organization.id,
  });

  if (error || !data || data.length === 0) return null;

  const row = data[0];
  return {
    planCode: row.plan_code,
    planName: row.plan_name,
    monthlyPriceUsd: row.monthly_price_usd === null ? null : Number(row.monthly_price_usd),
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
    servicesUsed: row.services_used,
    servicesLimit: row.services_limit,
    resourcesUsed: row.resources_used,
    resourcesLimit: row.resources_limit,
    customersUsed: row.customers_used,
    customersLimit: row.customers_limit,
    teamUsed: row.team_used,
    teamLimit: row.team_limit,
  };
}

export async function isPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_platform_admin");
  return data === true;
}

export interface PlatformOrganization {
  organizationId: string;
  slug: string;
  name: string;
  planCode: string | null;
  subscriptionStatus: "TRIALING" | "ACTIVE" | "PAST_DUE" | "SUSPENDED";
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  servicesUsed: number;
  customersUsed: number;
  teamUsed: number;
  createdAt: string;
}

export async function getPlatformOrganizations(): Promise<PlatformOrganization[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_organizations");

  if (error || !data) return [];

  return data.map(
    (row: {
      organization_id: string;
      slug: string;
      name: string;
      plan_code: string | null;
      subscription_status: PlatformOrganization["subscriptionStatus"];
      trial_ends_at: string | null;
      current_period_end: string | null;
      services_used: number;
      customers_used: number;
      team_used: number;
      created_at: string;
    }) => ({
      organizationId: row.organization_id,
      slug: row.slug,
      name: row.name,
      planCode: row.plan_code,
      subscriptionStatus: row.subscription_status,
      trialEndsAt: row.trial_ends_at,
      currentPeriodEnd: row.current_period_end,
      servicesUsed: row.services_used,
      customersUsed: row.customers_used,
      teamUsed: row.team_used,
      createdAt: row.created_at,
    }),
  );
}

export interface PlatformInvite {
  code: string;
  planCode: string;
  email: string | null;
  trialDays: number | null;
  expiresAt: string | null;
  redeemedAt: string | null;
  note: string | null;
  createdAt: string;
}

export async function getPlatformInvites(): Promise<PlatformInvite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_invites");

  if (error || !data) return [];

  return data.map(
    (row: {
      code: string;
      plan_code: string;
      email: string | null;
      trial_days: number | null;
      expires_at: string | null;
      redeemed_at: string | null;
      note: string | null;
      created_at: string;
    }) => ({
      code: row.code,
      planCode: row.plan_code,
      email: row.email,
      trialDays: row.trial_days,
      expiresAt: row.expires_at,
      redeemedAt: row.redeemed_at,
      note: row.note,
      createdAt: row.created_at,
    }),
  );
}

export interface PlatformActionState {
  error: string | null;
  createdCode: string | null;
}

export async function createInvite(
  _prev: PlatformActionState,
  formData: FormData,
): Promise<PlatformActionState> {
  const supabase = await createClient();

  const trialDaysRaw = String(formData.get("trialDays") ?? "").trim();
  const { data, error } = await supabase.rpc("create_organization_invite", {
    p_plan_code: String(formData.get("planCode") ?? "starter"),
    p_email: String(formData.get("email") ?? "").trim() || null,
    p_trial_days: trialDaysRaw ? Number(trialDaysRaw) : null,
    p_expires_in_days: 30,
    p_note: String(formData.get("note") ?? "").trim() || null,
  });

  if (error) {
    return { error: "No se pudo generar el código", createdCode: null };
  }

  revalidatePath("/admin");
  return { error: null, createdCode: (data as { code: string }).code };
}

export async function setSubscription(
  organizationId: string,
  planCode: string,
  status: string,
): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("set_organization_subscription", {
    p_organization_id: organizationId,
    p_plan_code: planCode,
    p_status: status,
  });
  revalidatePath("/admin");
}
