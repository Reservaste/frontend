"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { monthRange } from "@/lib/billing-period";

// The payments screens answer one question -- who paid and who did not --
// so everything here is shaped around a period, not around a customer.

export type RollupStatus = "PAID" | "PENDING" | "OVERDUE" | "PARTIAL" | "NO_PAYMENTS";

export interface PaymentSummaryRow {
  customerId: string;
  customerName: string;
  isActive: boolean;
  servicesCount: number;
  total: number;
  paid: number;
  pending: number;
  rollupStatus: RollupStatus;
}

export async function getPaymentSummary(
  organizationSlug: string,
  month?: string,
): Promise<PaymentSummaryRow[]> {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const range = monthRange(month);

  const { data, error } = await supabase.rpc("organization_payment_summary", {
    p_organization_id: organization.id,
    p_period_start: range.from,
    p_period_end: range.to,
  });
  if (error || !data) return [];

  return data.map(
    (row: {
      customer_id: string;
      customer_name: string;
      is_active: boolean;
      services_count: number;
      total: string | number;
      paid: string | number;
      pending: string | number;
      rollup_status: RollupStatus;
    }) => ({
      customerId: row.customer_id,
      customerName: row.customer_name,
      isActive: row.is_active,
      servicesCount: row.services_count,
      total: Number(row.total),
      paid: Number(row.paid),
      pending: Number(row.pending),
      rollupStatus: row.rollup_status,
    }),
  );
}

export interface PaymentDetailRow {
  paymentId: string;
  serviceId: string;
  serviceName: string;
  periodStart: string;
  periodEnd: string;
  status: "PAID" | "PENDING" | "OVERDUE" | "VOID";
  amount: number | null;
  createdAt: string;
}

export async function getCustomerPaymentDetail(
  organizationSlug: string,
  customerId: string,
  month?: string,
): Promise<PaymentDetailRow[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();
  const range = monthRange(month);

  const { data, error } = await supabase.rpc("customer_payment_detail", {
    p_customer_id: customerId,
    p_period_start: range.from,
    p_period_end: range.to,
  });
  if (error || !data) return [];

  return data.map(
    (row: {
      payment_id: string;
      service_id: string;
      service_name: string;
      period_start: string;
      period_end: string;
      status: PaymentDetailRow["status"];
      amount: string | number | null;
      created_at: string;
    }) => ({
      paymentId: row.payment_id,
      serviceId: row.service_id,
      serviceName: row.service_name,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      status: row.status,
      amount: row.amount === null ? null : Number(row.amount),
      createdAt: row.created_at,
    }),
  );
}

/** <form action> target, so it resolves to void. */
export async function setPaymentStatus(
  organizationSlug: string,
  payload: { paymentId: string; status: "PAID" | "PENDING" | "OVERDUE" | "VOID" },
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("set_payment_status", {
    p_payment_id: payload.paymentId,
    p_status: payload.status,
  });

  // Marking a month paid can confirm pending dates of a standing
  // reservation, which live on other screens (ADR-0019).
  revalidatePath(`/org/${organizationSlug}`, "layout");
}
