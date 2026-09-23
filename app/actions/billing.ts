"use server";

import { revalidatePath } from "next/cache";
import { mapPayment } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import type { ActionState } from "@/app/actions/admin";

// Payments are plain table writes (RLS gates them to org members) rather
// than RPCs: unlike booking, there is no concurrency requirement -- this
// is admin data entry. The rules that do matter (no overlapping PAID
// periods for the same customer and service, no deleting a payment) are
// enforced by constraints and policies in the schema, not by this layer.

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

  const serviceId = String(formData.get("serviceId") ?? "");
  const servicePlanId = String(formData.get("servicePlanId") ?? "");
  const periodStart = String(formData.get("periodStart") ?? "");
  const periodEnd = String(formData.get("periodEnd") ?? "");
  const amountRaw = String(formData.get("amount") ?? "").trim();

  if (!serviceId || !periodStart || !periodEnd) {
    return { error: "Elegí el servicio y el período", success: null };
  }

  // ADR-0024: a payment is anchored to the plan that was bought -- that is
  // where the booking path reads "what does this month entitle them to".
  // The compatibility bridge in the database still fills it in from the
  // service's active UNLIMITED plan when it's missing, and raises
  // PAYMENT_REQUIRES_PLAN when there is none; sending it explicitly is
  // what lets that bridge go away.
  if (!servicePlanId) {
    return { error: "Elegí el plan que está pagando", success: null };
  }

  // Registering a payment can unblock pending dates of a standing
  // reservation (the database reconciles them on insert). Counting before
  // and after is how the front desk finds out it happened -- otherwise
  // the classes silently confirm on a page nobody is looking at.
  const countPendingDates = async () => {
    const { count } = await supabase
      .from("bookings")
      .select("id, slot_occurrences!inner(start_at)", { count: "exact", head: true })
      .eq("customer_id", customerId)
      .eq("status", "NOT_GENERATED")
      .not("recurring_booking_id", "is", null)
      .gte("slot_occurrences.start_at", new Date().toISOString());
    return count ?? 0;
  };

  const pendingBefore = await countPendingDates();

  const { error } = await supabase.from("payments").insert({
    organization_id: organization.id,
    customer_id: customerId,
    service_id: serviceId,
    service_plan_id: servicePlanId,
    period_start: periodStart,
    period_end: periodEnd,
    status: String(formData.get("status") ?? "PAID"),
    amount: amountRaw ? Number(amountRaw) : null,
    notes: String(formData.get("notes") ?? "") || null,
    created_by: user?.id,
  });

  if (error) {
    // The EXCLUDE constraint (ADR-0022, moved onto payment_service_coverage
    // by ADR-0029) rejects a second PAID period overlapping an existing one
    // for the same customer/service -- that's a double charge, worth saying
    // plainly rather than as a generic failure.
    if (error.message.includes("payment_service_coverage_no_overlap")) {
      return { error: "Ya hay un pago registrado que cubre parte de ese período", success: null };
    }
    if (error.message.includes("payments_valid_period")) {
      return { error: "El fin del período no puede ser anterior al inicio", success: null };
    }
    // ADR-0024. The bridge fails loudly rather than leaving a payment the
    // booking path would have to read as "unlimited, just in case" -- but
    // the raw code means nothing at a front desk, and the way out is a
    // screen away.
    if (error.message.includes("PAYMENT_REQUIRES_PLAN")) {
      return {
        error:
          "Ese servicio todavía no tiene ningún plan activo, así que no se sabe qué compra este pago. Creá un plan en el servicio y volvé a registrarlo.",
        success: null,
      };
    }
    if (error.message.includes("PAYMENT_PLAN_KIND_REQUIRES_OCCURRENCE")) {
      return {
        error:
          "Un plan de turno suelto se cobra desde el turno, no desde acá: hay que decir qué turno se pagó.",
        success: null,
      };
    }
    if (error.message.includes("PAYMENT_PLAN_NOT_FOUND")) {
      return { error: "Ese plan ya no existe. Recargá la pantalla y elegí de nuevo.", success: null };
    }
    if (error.message.includes("payments_one_paid_per_occurrence_idx")) {
      return { error: "Ese turno ya está pago por este cliente", success: null };
    }
    // Fase 25: el mismo invariante que el EXCLUDE, para los pagos que
    // todavía no están cobrados. Dos pendientes idénticos son una carga
    // repetida en el mostrador, no dos deudas.
    if (error.message.includes("PAYMENT_DUPLICATE_PERIOD")) {
      return {
        error:
          "Ya hay un pago de este cliente para ese servicio que cubre parte de ese período. Anulá el anterior si lo estás corrigiendo.",
        success: null,
      };
    }
    if (error.message.includes("PAYMENT_DUPLICATE_OCCURRENCE")) {
      return { error: "Ese turno ya tiene un pago registrado para este cliente", success: null };
    }
    if (error.message.includes("SERVICE_PLAN_SCOPE_EMPTY")) {
      return {
        error: "Ese plan no cubre ningún servicio. Revisalo en la pantalla de planes antes de cobrarlo.",
        success: null,
      };
    }
    return { error: "No se pudo registrar el pago", success: null };
  }

  const confirmed = pendingBefore - (await countPendingDates());

  // "layout" so the service schedule pages, which show the standing
  // reservations, pick up the newly confirmed dates too.
  revalidatePath(`/org/${organizationSlug}`, "layout");

  return {
    error: null,
    success:
      confirmed > 0
        ? `Pago registrado · se confirmaron ${confirmed} ${confirmed === 1 ? "fecha" : "fechas"} del horario fijo`
        : "Pago registrado",
  };
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
