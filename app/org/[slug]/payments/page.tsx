import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getPaymentSummary, monthRange } from "@/app/actions/payments";
import { PageHeader } from "@/components/page-header";
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
  await requireOrganizationMembership(slug);

  const range = monthRange(mes);
  const rows = await getPaymentSummary(slug, range.month);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Pagos"
        description="Quién pagó y quién no, mes a mes"
        actions={<MonthPicker organizationSlug={slug} month={range.month} />}
      />

      <PaymentsList organizationSlug={slug} month={range.month} rows={rows} />
    </div>
  );
}
