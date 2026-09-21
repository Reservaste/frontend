"use client";

import { useActionState } from "react";
import type { Payment, Service } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import { registerPayment, voidPayment } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const initialState: ActionState = { error: null, success: null };

export function RegisterPaymentForm({
  organizationSlug,
  customerId,
  services,
}: {
  organizationSlug: string;
  customerId: string;
  services: Service[];
}) {
  const [state, formAction, pending] = useActionState(
    registerPayment.bind(null, organizationSlug, customerId),
    initialState,
  );

  // Any active service can take a payment: whether one is *required* to
  // book is a property of the service (ADR-0022), not a per-customer
  // permission somebody had to grant first.
  const payable = services.filter((s) => s.isActive);

  if (payable.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        Cargá un servicio antes de registrar pagos.
      </p>
    );
  }

  const today = new Date();
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="serviceId">Servicio</Label>
          <select id="serviceId" name="serviceId" required className={selectClass}>
            {payable.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodStart">Período desde</Label>
          <Input
            id="periodStart"
            name="periodStart"
            type="date"
            defaultValue={firstOfMonth.toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="periodEnd">Período hasta</Label>
          <Input
            id="periodEnd"
            name="periodEnd"
            type="date"
            defaultValue={lastOfMonth.toISOString().slice(0, 10)}
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="amount">Monto (opcional)</Label>
          <Input id="amount" name="amount" type="number" min={0} step="0.01" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Estado</Label>
          <select id="status" name="status" className={selectClass}>
            <option value="PAID">Pagado</option>
            <option value="PENDING">Pendiente</option>
            <option value="OVERDUE">Vencido</option>
          </select>
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Registrando…" : "Registrar pago"}
      </Button>
    </form>
  );
}

export function PaymentList({
  organizationSlug,
  customerId,
  payments,
  services,
}: {
  organizationSlug: string;
  customerId: string;
  payments: Payment[];
  services: Service[];
}) {
  if (payments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Sin pagos registrados.
      </p>
    );
  }

  const statusMeta: Record<Payment["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    PAID: { label: "Pagado", tone: "success" },
    PENDING: { label: "Pendiente", tone: "warning" },
    OVERDUE: { label: "Vencido", tone: "danger" },
    VOID: { label: "Anulado", tone: "neutral" },
  };

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
      {payments.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-col gap-0.5">
            {/* Which service the payment is for: without it the list is
                just amounts and dates, which answers nothing. */}
            <span className="text-sm font-medium">
              {services.find((s) => s.id === p.serviceId)?.name ?? "Servicio"}
            </span>
            <span className="tnum text-xs text-muted-foreground">
              {p.periodStart} → {p.periodEnd}
            </span>
            <div className="flex items-center gap-2">
              <StatusBadge tone={statusMeta[p.status].tone}>{statusMeta[p.status].label}</StatusBadge>
              {p.amount !== null ? (
                <span className="tnum text-xs text-muted-foreground">${p.amount}</span>
              ) : null}
            </div>
          </div>
          {p.status !== "VOID" ? (
            <form action={voidPayment.bind(null, organizationSlug, customerId, p.id)}>
              <Button type="submit" variant="ghost" size="xs">
                Anular
              </Button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
