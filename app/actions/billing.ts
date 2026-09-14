"use server";

import { revalidatePath } from "next/cache";
import { mapPayment, mapServiceEntitlement } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";

// Entitlements and payments are plain table writes (RLS gates them to
// org members) rather than RPCs: unlike booking, neither has a
// concurrency requirement -- they're admin data entry. The rules that do
// matter (an entitlement's vigencia shape, no overlapping PAID periods,
// no deleting a payment) are enforced by constraints and policies in the
// schema, not by this layer.

export async function getCustomerEntitlements(organizationSlug: string, customerId: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("service_entitlements")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data.map(mapServiceEntitlement);
}

export async function getCustomerPayments(organizationSlug: string, customerId: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payments")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("customer_id", customerId)
    .order("period_start", { ascending: false });

  if (error || !data) return [];
  return data.map(mapPayment);
}

export async function grantEntitlement(
  organizationSlug: string,
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceId = String(formData.get("serviceId") ?? "");
  const entitlementType = String(formData.get("entitlementType") ?? "TIME");
  const requiresActivePayment = formData.get("requiresActivePayment") === "on";

  if (!serviceId) {
    return { error: "Elegí un servicio", success: null };
  }

  const base = {
    organization_id: organization.id,
    customer_id: customerId,
    service_id: serviceId,
    requires_active_payment: requiresActivePayment,
    created_by: user?.id,
  };

  // The schema's CHECK constraint enforces that TIME rows carry a
  // validity window and CREDITS rows carry counters, never both -- these
  // two branches are what satisfies it.
  let row;
  if (entitlementType === "CREDITS") {
    const credits = Number(formData.get("creditsTotal"));
    if (!Number.isInteger(credits) || credits < 1) {
      return { error: "Los créditos tienen que ser un número mayor a 0", success: null };
    }
    row = {
      ...base,
      entitlement_type: "CREDITS",
      credits_total: credits,
      credits_remaining: credits,
    };
  } else {
    row = {
      ...base,
      entitlement_type: "TIME",
      valid_from: String(formData.get("validFrom") || new Date().toISOString().slice(0, 10)),
      valid_until: String(formData.get("validUntil") || "") || null,
    };
  }

  const { error } = await supabase.from("service_entitlements").insert(row);
  if (error) {
    return { error: "No se pudo habilitar el servicio", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
  return { error: null, success: "Servicio habilitado" };
}

export async function revokeEntitlement(
  organizationSlug: string,
  customerId: string,
  entitlementId: string,
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase
    .from("service_entitlements")
    .update({
      is_active: false,
      cancelled_at: new Date().toISOString(),
      cancelled_by: user?.id,
      cancellation_reason: "ORGANIZATION_REVOKED",
    })
    .eq("id", entitlementId);

  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
}

export async function registerPayment(
  organizationSlug: string,
  customerId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const serviceEntitlementId = String(formData.get("serviceEntitlementId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!serviceEntitlementId || !periodStart || !periodEnd) {
    return { error: "Completá el servicio habilitado y el período", success: null };
  }

  const { error } = await supabase.from("payments").insert({
    organization_id: organization.id,
    customer_id: customerId,
    service_entitlement_id: serviceEntitlementId,
    period_start: periodStart,
    period_end: periodEnd,
    status: String(formData.get("status") ?? "PAID"),
    amount: amountRaw ? Number(amountRaw) : null,
    notes: String(formData.get("notes") ?? "") || null,
    created_by: user?.id,
  });

  if (error) {
    // The EXCLUDE constraint (ADR-0013) rejects a second PAID period
    // overlapping an existing one -- that's a double charge, worth saying
    // plainly rather than as a generic failure.
    if (error.message.includes("payments_no_overlapping_paid")) {
      return { error: "Ya hay un pago registrado que cubre parte de ese período", success: null };
    }
    if (error.message.includes("payments_valid_period")) {
      return { error: "El fin del período no puede ser anterior al inicio", success: null };
    }
    return { error: "No se pudo registrar el pago", success: null };
  }

  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
  return { error: null, success: "Pago registrado" };
}

export async function voidPayment(
  organizationSlug: string,
  customerId: string,
  paymentId: string,
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  // Never deleted -- the schema has no DELETE policy for payments.
  await supabase.from("payments").update({ status: "VOID" }).eq("id", paymentId);
  revalidatePath(`/org/${organizationSlug}/customers/${customerId}`);
}
