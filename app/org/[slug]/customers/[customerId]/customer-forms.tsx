"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Payment, Service, ServicePlan } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import type { PaymentPlanOption } from "@/app/actions/service-plans";
import { registerPayment, voidPayment } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { formatMoney } from "@/lib/money";
import { planSummary } from "@/lib/plan-labels";

const initialState: ActionState = { error: null, success: null };

/**
 * Registering a payment at the front desk (ADR-0024).
 *
 * A payment is anchored to a **plan**, not just to a service: the plan is
 * what the booking path reads to answer "what does this month entitle them
 * to" -- a single slot, N fixed weekly slots, or no limit. Picking it
 * prefills the amount and the period, both of which used to be typed by
 * hand.
 *
 * The period comes from `billing_period_for()` resolved on the server, one
 * value per plan, and not from arithmetic here: "paying on the 15th covers
 * from the 1st" is a business rule and a second copy of it in the browser
 * would drift from the one the rest of the system uses.
 *
 * A service with no plan simply can't be offered here. The database bridge
 * raises `PAYMENT_REQUIRES_PLAN` rather than record a payment nobody can
 * interpret, and a raw error code at a front desk is useless -- so this
 * screen shows the way out instead of letting anyone reach it.
 */
export function RegisterPaymentForm({
  organizationSlug,
  customerId,
  services,
  plans,
  currency,
}: {
  organizationSlug: string;
  customerId: string;
  services: Service[];
  /** Active plans of the whole organization, with their period resolved. */
  plans: PaymentPlanOption[];
  currency: string;
}) {
  const [state, formAction, pending] = useActionState(
    registerPayment.bind(null, organizationSlug, customerId),
    initialState,
  );

  // Any active service can take a payment: whether one is *required* to
  // book is a property of the service (ADR-0022), not a per-customer
  // permission somebody had to grant first.
  const payable = services.filter((s) => s.isActive);

  // A DROP_IN plan is left out on purpose: its payment has to name the
  // occurrence it pays for (payments.slot_occurrence_id, enforced by
  // trigger), and that is the "pagá este turno" flow on the agenda, not
  // this form. Offering it here would produce a rejected insert every time.
  const chargeable = plans.filter((plan) => plan.planKind !== "DROP_IN");
  const plansFor = (serviceId: string) => chargeable.filter((plan) => plan.serviceId === serviceId);

  const eligible = payable.filter((service) => plansFor(service.id).length > 0);
  const blocked = payable.filter((service) => plansFor(service.id).length === 0);

  const [serviceId, setServiceId] = useState(eligible[0]?.id ?? "");
  const [planId, setPlanId] = useState(eligible[0] ? (plansFor(eligible[0].id)[0]?.id ?? "") : "");

  const today = new Date();
  const firstOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10);
  const lastOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10);

  const servicePlans = plansFor(serviceId);
  const selectedPlan = servicePlans.find((plan) => plan.id === planId) ?? servicePlans[0];

  // React's "adjust state during render" pattern: the selected service can
  // lose its last plan under us (someone deactivates it on another screen),
  // and the fallback has to be a service that still has one. The
  // `serviceId !==` guard is what makes this converge instead of loop.
  const fallbackService = eligible[0];
  if (!selectedPlan && fallbackService && serviceId !== fallbackService.id) {
    setServiceId(fallbackService.id);
    setPlanId(plansFor(fallbackService.id)[0]?.id ?? "");
  }

  const missingPlans = blocked.length > 0 ? <MissingPlans organizationSlug={organizationSlug} services={blocked} /> : null;

  if (payable.length === 0) {
    return <EmptyState size="sm" title="Cargá un servicio antes de registrar pagos." />;
  }

  if (eligible.length === 0 || !selectedPlan) {
    return (
      <div className="flex flex-col gap-3">
        <EmptyState
          size="sm"
          title="Ningún servicio tiene todavía un plan que se pueda cobrar acá."
          description="Un pago dice qué compró el cliente, así que primero hace falta un plan: un precio y lo que ese precio da."
        />
        {missingPlans}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <Label htmlFor="serviceId">Servicio</Label>
            <Select
              id="serviceId"
              name="serviceId"
              required
              value={serviceId}
              onChange={(event) => {
                const next = event.target.value;
                setServiceId(next);
                // The plan list is per service, so a stale plan id here
                // would post a plan of another service and the trigger
                // would reject it.
                setPlanId(plansFor(next)[0]?.id ?? "");
              }}
            >
              {eligible.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field className="sm:col-span-2">
            <Label htmlFor="servicePlanId">Plan</Label>
            <Select
              id="servicePlanId"
              name="servicePlanId"
              required
              value={selectedPlan.id}
              onChange={(event) => setPlanId(event.target.value)}
            >
              {servicePlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} · {formatMoney(plan.price, currency)}
                </option>
              ))}
            </Select>
            <FieldHint>
              {planSummary(selectedPlan.planKind, selectedPlan.weeklyQuota)}. El monto y el período
              se completan con este plan; podés ajustarlos.
            </FieldHint>
          </Field>

          {/* Keyed on the plan so picking another one refreshes the
              prefilled values, while leaving them editable: registering
              last month's payment is a real thing that happens. */}
          <Field key={`period-${selectedPlan.id}`}>
            <Label htmlFor="periodStart">Período desde</Label>
            <Input
              id="periodStart"
              name="periodStart"
              type="date"
              defaultValue={selectedPlan.periodStart ?? firstOfMonth}
              required
            />
          </Field>
          <Field key={`period-end-${selectedPlan.id}`}>
            <Label htmlFor="periodEnd">Período hasta</Label>
            <Input
              id="periodEnd"
              name="periodEnd"
              type="date"
              defaultValue={selectedPlan.periodEnd ?? lastOfMonth}
              required
            />
          </Field>
          <Field key={`amount-${selectedPlan.id}`}>
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={selectedPlan.price}
            />
          </Field>
          <Field>
            <Label htmlFor="status">Estado</Label>
            <Select id="status" name="status">
              <option value="PAID">Pagado</option>
              <option value="PENDING">Pendiente</option>
              <option value="OVERDUE">Vencido</option>
            </Select>
          </Field>
        </div>

        <FormError>{state.error}</FormError>
        <FormSuccess>{state.success}</FormSuccess>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Registrando…" : "Registrar pago"}
        </Button>
      </form>

      {missingPlans}
    </div>
  );
}

/** The services that can't be charged yet, each with the way out. */
function MissingPlans({
  organizationSlug,
  services,
}: {
  organizationSlug: string;
  services: Service[];
}) {
  return (
    <Alert tone="warning" size="sm" title="Servicios sin plan para cobrar">
      <ul className="mt-1 flex flex-col gap-1">
        {services.map((service) => (
          <li key={service.id}>
            <Link
              href={`/org/${organizationSlug}/services/${service.id}/plans`}
              className="underline underline-offset-4"
            >
              Crear un plan para {service.name}
            </Link>
          </li>
        ))}
      </ul>
    </Alert>
  );
}

export function PaymentList({
  organizationSlug,
  customerId,
  payments,
  services,
  plans,
  currency,
}: {
  organizationSlug: string;
  customerId: string;
  payments: Payment[];
  services: Service[];
  /** Every plan of the organization, active or not: a payment outlives the plan's listing. */
  plans: ServicePlan[];
  currency: string;
}) {
  if (payments.length === 0) {
    return <EmptyState size="sm" title="Sin pagos registrados." />;
  }

  const statusMeta: Record<Payment["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    PAID: { label: "Pagado", tone: "success" },
    PENDING: { label: "Pendiente", tone: "warning" },
    OVERDUE: { label: "Vencido", tone: "danger" },
    VOID: { label: "Anulado", tone: "neutral" },
  };

  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
      {payments.map((p) => {
        const plan = plans.find((candidate) => candidate.id === p.servicePlanId);

        return (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              {/* Which service the payment is for: without it the list is
                  just amounts and dates, which answers nothing. */}
              <span className="text-sm font-medium">
                {services.find((s) => s.id === p.serviceId)?.name ?? "Servicio"}
              </span>
              {/* And which plan: after ADR-0024 "pagó el mes" is not one
                  thing -- it says how many fixed slots that month bought. */}
              {plan ? (
                <span className="text-xs text-muted-foreground">
                  {plan.name} · {planSummary(plan.planKind, plan.weeklyQuota)}
                </span>
              ) : null}
              <span className="tnum text-xs text-muted-foreground">
                {p.periodStart} → {p.periodEnd}
              </span>
              <div className="flex items-center gap-2">
                <StatusBadge tone={statusMeta[p.status].tone}>{statusMeta[p.status].label}</StatusBadge>
                {p.amount !== null ? (
                  <span className="tnum text-xs text-muted-foreground">
                    {formatMoney(p.amount, currency)}
                  </span>
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
        );
      })}
    </ul>
  );
}
