"use client";

import { useActionState, useState } from "react";
import type { Payment, Service, ServiceEntitlement } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import { grantEntitlement, registerPayment, revokeEntitlement, voidPayment } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="serviceId">Servicio</Label>
          <select
            id="serviceId"
            name="serviceId"
            required
            className="h-9 rounded-md border bg-background px-3 text-sm"
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
            className="h-9 rounded-md border bg-background px-3 text-sm"
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
    return <p className="text-sm text-muted-foreground">Sin servicios habilitados.</p>;
  }

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {entitlements.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm">{serviceName(e.serviceId)}</span>
            <span className="text-xs text-muted-foreground">
              {e.entitlementType === "TIME"
                ? `${e.validFrom}${e.validUntil ? ` → ${e.validUntil}` : " → sin vencimiento"}`
                : `${e.creditsRemaining} de ${e.creditsTotal} créditos`}
              {e.requiresActivePayment ? " · requiere pago" : " · cortesía"}
              {e.isActive ? "" : " · revocado"}
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
      <p className="text-sm text-muted-foreground">
        No hay servicios habilitados que requieran pago.
      </p>
    );
  }

  const today = new Date();
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const lastOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="serviceEntitlementId">Servicio habilitado</Label>
          <select
            id="serviceEntitlementId"
            name="serviceEntitlementId"
            required
            className="h-9 rounded-md border bg-background px-3 text-sm"
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
          <select id="status" name="status" className="h-9 rounded-md border bg-background px-3 text-sm">
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
    return <p className="text-sm text-muted-foreground">Sin pagos registrados.</p>;
  }

  const statusLabel: Record<Payment["status"], string> = {
    PAID: "Pagado",
    PENDING: "Pendiente",
    OVERDUE: "Vencido",
    VOID: "Anulado",
  };

  return (
    <ul className="flex flex-col divide-y rounded-lg border">
      {payments.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm tabular-nums">
              {p.periodStart} → {p.periodEnd}
            </span>
            <span className="text-xs text-muted-foreground">
              {statusLabel[p.status]}
              {p.amount !== null ? ` · $${p.amount}` : ""}
            </span>
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
