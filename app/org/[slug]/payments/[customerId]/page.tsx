import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { getCustomerPaymentDetail, setPaymentStatus } from "@/app/actions/payments";
import { monthRange } from "@/lib/billing-period";
import { listServices } from "@/app/actions/services";
import { listPaymentPlanOptions } from "@/app/actions/service-plans";
import { formatMoney } from "@/lib/money";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DataList, DataListRow } from "@/components/ui/table";
import { RegisterPaymentForm } from "../../customers/[customerId]/customer-forms";

export const metadata = { title: "Pagos del cliente" };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PAID: { label: "Pagado", tone: "success" },
  PENDING: { label: "Pendiente", tone: "warning" },
  OVERDUE: { label: "Vencido", tone: "danger" },
  VOID: { label: "Anulado", tone: "neutral" },
};

export default async function CustomerPaymentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; customerId: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  const { slug, customerId } = await params;
  const { mes } = await searchParams;
  const { organization } = await requireOrganizationMembership(slug);

  const range = monthRange(mes);
  const [customers, rows, services, planOptions] = await Promise.all([
    getCustomers(slug),
    getCustomerPaymentDetail(slug, customerId, range.month),
    listServices(slug),
    // Fase 25: esta pantalla es una pantalla *sobre un mes*. Sin pasarle
    // `range.month`, `billing_period_for()` resolvía el período desde hoy
    // y "Agregar pago" cargaba el mes equivocado estando parado en otro
    // (rechazado por el EXCLUDE si ese mes ya estaba pago, o invisible si
    // quedaba PENDING en un mes que esta pantalla no lista).
    listPaymentPlanOptions(slug, range.month),
  ]);

  // Prices are quoted in the organization's currency (ADR-0024), not in a
  // hardcoded "$".
  const money = (value: number) => formatMoney(value, organization.currency);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) {
    notFound();
  }

  const live = rows.filter((r) => r.status !== "VOID");
  const total = live.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const paid = live.filter((r) => r.status === "PAID").reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const monthLabelRaw = new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${range.month}-01T12:00:00Z`));
  // Intl gives lowercase month names in es-UY ("septiembre de 2026");
  // `PageHeader`'s description isn't styled with `capitalize` (it's plain
  // page copy elsewhere), so the sentence case is fixed here instead.
  const monthLabel = monthLabelRaw.charAt(0).toUpperCase() + monthLabelRaw.slice(1);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Pagos", href: `/org/${slug}/payments?mes=${range.month}` },
          { label: customer.fullName },
        ]}
      />

      <PageHeader
        title={customer.fullName}
        description={monthLabel}
        actions={
          <Link
            href={`/org/${slug}/customers/${customerId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Ver cliente
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total", value: money(total) },
          { label: "Pagado", value: money(paid) },
          { label: "Pendiente", value: money(total - paid) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-card">
            <span className="eyebrow text-muted-foreground">{stat.label}</span>
            <span className="tnum text-xl font-semibold leading-none">{stat.value}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Servicios del período</h2>

        {rows.length === 0 ? (
          <EmptyState size="sm" title="Sin pagos registrados para este mes." />
        ) : (
          <DataList>
            {rows.map((row) => {
              const meta = STATUS[row.status]!;
              return (
                <DataListRow key={row.paymentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="truncate font-medium">{row.serviceName}</span>
                    <span className="tnum text-xs text-muted-foreground">
                      {row.periodStart} → {row.periodEnd}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="tnum text-sm font-semibold">
                      {row.amount === null ? "—" : money(row.amount)}
                    </span>
                    <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>

                    {/* Marking a month paid here can confirm pending dates
                        of a standing reservation (ADR-0019). */}
                    {row.status !== "PAID" && row.status !== "VOID" ? (
                      <form action={setPaymentStatus.bind(null, slug, { paymentId: row.paymentId, status: "PAID" })}>
                        <Button type="submit" size="xs">
                          Marcar pagado
                        </Button>
                      </form>
                    ) : null}
                    {row.status === "PAID" ? (
                      <form action={setPaymentStatus.bind(null, slug, { paymentId: row.paymentId, status: "PENDING" })}>
                        <Button type="submit" variant="ghost" size="xs">
                          Corregir
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </DataListRow>
              );
            })}
          </DataList>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Agregar pago</h2>
        <RegisterPaymentForm
          organizationSlug={slug}
          customerId={customerId}
          services={services}
          plans={planOptions}
          currency={organization.currency}
          month={range.month}
        />
      </section>
    </div>
  );
}
