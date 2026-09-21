import { notFound } from "next/navigation";
import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { getCustomerPaymentDetail, monthRange, setPaymentStatus } from "@/app/actions/payments";
import { listServices } from "@/app/actions/services";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { StatusBadge } from "@/components/status";
import { Button, buttonVariants } from "@/components/ui/button";
import { RegisterPaymentForm } from "../../customers/[customerId]/customer-forms";

export const metadata = { title: "Pagos del cliente" };

const money = (value: number) => `$${value.toLocaleString("es-UY")}`;

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
  await requireOrganizationMembership(slug);

  const range = monthRange(mes);
  const [customers, rows, services] = await Promise.all([
    getCustomers(slug),
    getCustomerPaymentDetail(slug, customerId, range.month),
    listServices(slug),
  ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) {
    notFound();
  }

  const live = rows.filter((r) => r.status !== "VOID");
  const total = live.reduce((sum, r) => sum + (r.amount ?? 0), 0);
  const paid = live.filter((r) => r.status === "PAID").reduce((sum, r) => sum + (r.amount ?? 0), 0);

  const monthLabel = new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${range.month}-01T12:00:00Z`));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Pagos", href: `/org/${slug}/payments?mes=${range.month}` },
          { label: customer.fullName },
        ]}
      />

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl">{customer.fullName}</h1>
          <p className="text-sm capitalize text-muted-foreground">{monthLabel}</p>
        </div>
        <Link
          href={`/org/${slug}/customers/${customerId}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Ver cliente
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total", value: money(total) },
          { label: "Pagado", value: money(paid) },
          { label: "Pendiente", value: money(total - paid) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-card">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </span>
            <span className="tnum text-xl font-semibold leading-none">{stat.value}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Servicios del período</h2>

        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Sin pagos registrados para este mes.
          </p>
        ) : (
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
            {rows.map((row) => {
              const meta = STATUS[row.status]!;
              return (
                <li key={row.paymentId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
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
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Agregar pago</h2>
        <RegisterPaymentForm organizationSlug={slug} customerId={customerId} services={services} />
      </section>
    </div>
  );
}
