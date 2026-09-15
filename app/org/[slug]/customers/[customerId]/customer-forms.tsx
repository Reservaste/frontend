"use client";

import { useActionState, useState } from "react";
import type { Payment, Service, ServiceEntitlement } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import { grantEntitlement, registerPayment, revokeEntitlement, voidPayment } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status";

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const initialState: ActionState = { error: null, success: null };

export function GrantEntitlementForm({
  organizationSlug,
  customerId,
  services,
}: {
  organizationSlug: string;
  customerId: string;
  services: Service[];
}) {
  const [type, setType] = useState<"TIME" | "CREDITS">("TIME");
  const [state, formAction, pending] = useActionState(
    grantEntitlement.bind(null, organizationSlug, customerId),
    initialState,
  );

  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">Creá un servicio primero para poder habilitarlo.</p>;
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serviceId">Servicio</Label>
          <select
            id="serviceId"
            name="serviceId"
            required
            className={selectClass}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entitlementType">Tipo</Label>
          <select
            id="entitlementType"
            name="entitlementType"
            value={type}
            onChange={(e) => setType(e.target.value as "TIME" | "CREDITS")}
            className={selectClass}
          >
            <option value="TIME">Por período</option>
            <option value="CREDITS">Por créditos</option>
          </select>
        </div>

        {type === "TIME" ? (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validFrom">Desde</Label>
              <Input
                id="validFrom"
                name="validFrom"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="validUntil">Hasta (opcional)</Label>
              <Input id="validUntil" name="validUntil" type="date" />
            </div>
          </>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="creditsTotal">Créditos</Label>
            <Input id="creditsTotal" name="creditsTotal" type="number" min={1} defaultValue={10} required />
          </div>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="requiresActivePayment" defaultChecked={type === "TIME"} />
        Requiere pago vigente
        <span className="text-xs text-muted-foreground">
          (destildado = cortesía o beca)
        </span>
      </label>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Habilitando…" : "Habilitar servicio"}
      </Button>
    </form>
  );
}

export function EntitlementList({
  organizationSlug,
  customerId,
  entitlements,
  services,
}: {
  organizationSlug: string;
  customerId: string;
  entitlements: ServiceEntitlement[];
  services: Service[];
}) {
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  if (entitlements.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
        Sin servicios habilitados.
      </p>
    );
  }

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
      {entitlements.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">{serviceName(e.serviceId)}</span>
              {!e.isActive ? (
                <StatusBadge tone="neutral">Revocado</StatusBadge>
              ) : e.requiresActivePayment ? (
                <StatusBadge tone="primary">Requiere pago</StatusBadge>
              ) : (
                <StatusBadge tone="success">Cortesía</StatusBadge>
              )}
            </div>
            <span className="text-xs text-muted-foreground">
              {e.entitlementType === "TIME"
                ? `${e.validFrom}${e.validUntil ? ` → ${e.validUntil}` : " · sin vencimiento"}`
                : `${e.creditsRemaining} de ${e.creditsTotal} créditos`}
            </span>
          </div>
          {e.isActive ? (
            <form action={revokeEntitlement.bind(null, organizationSlug, customerId, e.id)}>
              <Button type="submit" variant="ghost" size="xs">
                Revocar
              </Button>
            </form>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function RegisterPaymentForm({
  organizationSlug,
  customerId,
  entitlements,
  services,
}: {
  organizationSlug: string;
  customerId: string;
  entitlements: ServiceEntitlement[];
  services: Service[];
}) {
  const [state, formAction, pending] = useActionState(
    registerPayment.bind(null, organizationSlug, customerId),
    initialState,
  );

  const payable = entitlements.filter((e) => e.isActive && e.requiresActivePayment);
  const serviceName = (id: string) => services.find((s) => s.id === id)?.name ?? id;

  if (payable.length === 0) {
    return (
      <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
        No hay servicios habilitados que requieran pago.
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
          <Label htmlFor="serviceEntitlementId">Servicio habilitado</Label>
          <select
            id="serviceEntitlementId"
            name="serviceEntitlementId"
            required
            className={selectClass}
          >
            {payable.map((e) => (
              <option key={e.id} value={e.id}>
                {serviceName(e.serviceId)}
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
}: {
  organizationSlug: string;
  customerId: string;
  payments: Payment[];
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
            <span className="tnum text-sm font-medium">
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
