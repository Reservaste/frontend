import { getMyPayments } from "@/app/actions/customer";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";

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
      <h1 className="text-xl">Mis pagos</h1>

      {payments.length === 0 ? (
        <EmptyState
          title="Sin pagos registrados"
          description="Los pagos que registre el negocio van a aparecer acá."
        />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {payments.map((p) => {
            const status = STATUS[p.status] ?? { label: p.status, tone: "neutral" as const };
            return (
              <li key={p.paymentId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{p.serviceName}</span>
                  <span className="tnum text-xs text-muted-foreground">
                    {p.periodStart} → {p.periodEnd}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                  {p.amount !== null ? (
                    <span className="tnum text-xs text-muted-foreground">${p.amount}</span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
