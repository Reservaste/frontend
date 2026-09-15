import { getMyPayments } from "@/app/actions/customer";

const STATUS_LABEL: Record<string, string> = {
  PAID: "Pagado",
  PENDING: "Pendiente",
  OVERDUE: "Vencido",
  VOID: "Anulado",
};

export default async function MyPaymentsPage() {
  const payments = await getMyPayments();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Mis pagos</h1>

      {payments.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay pagos registrados.
        </p>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {payments.map((p) => (
            <li key={p.paymentId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex flex-col">
                <span className="text-sm">{p.serviceName}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {p.periodStart} → {p.periodEnd}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-sm">{STATUS_LABEL[p.status] ?? p.status}</span>
                {p.amount !== null ? (
                  <span className="text-xs tabular-nums text-muted-foreground">${p.amount}</span>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
