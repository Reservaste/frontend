import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { NoPermission } from "@/components/no-permission";
import { listPlanChangeRequests } from "@/app/actions/plan-changes";
import { getPaymentSummary } from "@/app/actions/payments";
import { monthRange } from "@/lib/billing-period";
import { PageHeader } from "@/components/page-header";
import { PlanChangeRequests } from "../plans/plan-change-requests";
import { MonthPicker } from "./month-picker";
import { PaymentsList } from "./payments-list";

export const metadata = { title: "Pagos" };

export default async function PaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { slug } = await params;
  const { mes } = await searchParams;
  const { organization, permissions } = await requireOrganizationMembership(slug);

  // ADR-0033: the tab is already hidden without VIEW_PAYMENTS; this covers
  // a bookmarked or typed URL with an honest message instead of an empty list.
  if (!hasOrgPermission(permissions, "VIEW_PAYMENTS")) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
        <PageHeader title="Pagos" />
        <NoPermission title="Tu rol no incluye ver pagos" />
      </div>
    );
  }

  const range = monthRange(mes);
  const canManagePayments = hasOrgPermission(permissions, "MANAGE_PAYMENTS");
  const [rows, planChanges] = await Promise.all([
    getPaymentSummary(slug, range.month),
    listPlanChangeRequests(slug),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Pagos"
        description="Quién pagó y quién no, mes a mes"
        actions={<MonthPicker organizationSlug={slug} month={range.month} />}
      />

      <PlanChangeRequests
        organizationSlug={slug}
        requests={planChanges.requests}
        error={planChanges.error}
        timezone={organization.timezone}
        canResolve={canManagePayments}
      />

      <PaymentsList organizationSlug={slug} month={range.month} rows={rows} />
    </div>
  );
}
