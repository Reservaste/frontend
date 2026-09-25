import { getMyPayments } from "@/app/actions/customer";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/page-header";
import { DataList, DataListRow } from "@/components/ui/table";
import { planSummary } from "@/lib/plan-labels";
import { formatMoney } from "@/lib/money";

export const metadata = { title: "Mis pagos" };

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  PAID: { label: "Pagado", tone: "success" },
  PENDING: { label: "Pendiente", tone: "warning" },
  OVERDUE: { label: "Vencido", tone: "danger" },
  VOID: { label: "Anulado", tone: "neutral" },
};

export default async function MyPaymentsPage() {
  const payments = await getMyPayments();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <PageHeader title="Mis pagos" />

      {payments.length === 0 ? (
        <EmptyState
          title="Sin pagos registrados"
          description="Los pagos que registre el negocio van a aparecer acá."
        />
      ) : (
        <DataList>
          {payments.map((p) => {
            const status = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
            // Un pago sin un único servicio (plan multi-servicio, ADR-0029)
            // no tiene un nombre "reconocible" propio -- el título cae al
            // nombre del plan, y "Todos los servicios" aclara que no es un
            // recorte a uno solo (mismo criterio que planScopeLabel()).
            const title = p.serviceName ?? p.planName;
            const scopeNote =
              p.serviceName === null && p.planAppliesToAllServices ? "Todos los servicios · " : "";
            return (
              <DataListRow key={p.paymentId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {scopeNote}
                    {planSummary(p.planKind, p.weeklyQuota)}
                  </span>
                  <span className="tnum text-xs text-muted-foreground">
                    {p.periodStart} → {p.periodEnd}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  {p.amount !== null ? (
                    <span className="tnum text-xs text-muted-foreground">
                      {formatMoney(p.amount, p.currency)}
                    </span>
                  ) : null}
                </div>
              </DataListRow>
            );
          })}
        </DataList>
      )}
    </div>
  );
}
