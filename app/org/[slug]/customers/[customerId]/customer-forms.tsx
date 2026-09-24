"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Payment, Service, ServicePlan } from "@reservaste/domain";
import type { ActionState, CustomerMakeupCredit } from "@/app/actions/admin";
import type { PaymentPlanOption } from "@/app/actions/service-plans";
import { grantManualMakeupCredit } from "@/app/actions/admin";
import { registerPayment, voidPayment } from "@/app/actions/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/status";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DataList, DataListRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { monthRange } from "@/lib/billing-period";
import { planSummary } from "@/lib/plan-labels";
import { formatPeriodRange, periodNoun, suggestedAmount } from "@/lib/billing-blocks";

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
  month,
  livePayments,
}: {
  organizationSlug: string;
  customerId: string;
  services: Service[];
  /** Active plans of the whole organization, with their period resolved. */
  plans: PaymentPlanOption[];
  currency: string;
  /**
   * Fase 25: el mes que la pantalla está mostrando ("YYYY-MM"), cuando la
   * pantalla es sobre un mes (`/payments/[customerId]?mes=`). Es el mismo
   * mes con el que se resolvió `plans`, y el que manda si un plan no trae
   * período propio. Sin él se cae a hoy, que es lo correcto en la ficha
   * del cliente: esa pantalla no habla de ningún mes en particular.
   */
  month?: string;
  /**
   * ADR-0031: the customer's non-VOID payments, so a plan change (the
   * period is already paid for that service) is suggested at full price
   * instead of prorated -- see `suggestedAmount()`.
   */
  livePayments?: { serviceId: string | null; periodStart: string; periodEnd: string }[];
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
  // ADR-0029: a plan can cover several services now, so it shows up under
  // every service it covers rather than exactly one.
  const plansFor = (serviceId: string) => chargeable.filter((plan) => plan.serviceIds.includes(serviceId));

  const eligible = payable.filter((service) => plansFor(service.id).length > 0);
  const blocked = payable.filter((service) => plansFor(service.id).length === 0);

  const [serviceId, setServiceId] = useState(eligible[0]?.id ?? "");
  const [planId, setPlanId] = useState(eligible[0] ? (plansFor(eligible[0].id)[0]?.id ?? "") : "");

  // El mes que se está mirando gana sobre el del navegador. Es sólo el
  // respaldo para un plan sin período resuelto: el período real lo sigue
  // dando `billing_period_for()` en el servidor, anclado al mismo mes.
  const { from: firstOfMonth, to: lastOfMonth } = monthRange(month);

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

  // ADR-0031: which of the server's two prices to prefill. The proration
  // itself is computed in SQL (`quote_service_plan_period()`); this only
  // picks between the full price and the prorated one, and falls back to
  // the full price when the service is already paid for that period (a
  // plan change is never prorated -- ADR-0031 resolución 3).
  const suggestion = selectedPlan
    ? suggestedAmount(
        selectedPlan,
        // A payment with no service of its own (anchored to a multi-service
        // plan) counts too: when unsure, suggest the full price rather than
        // under-charge.
        (livePayments ?? []).filter((p) => p.serviceId === null || selectedPlan.serviceIds.includes(p.serviceId)),
      )
    : { amount: 0, mode: "full" as const };
  const longCycle =
    selectedPlan && (selectedPlan.billingPeriodMonths ?? 1) > 1 ? (selectedPlan.billingPeriodMonths as number) : null;

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
              last month's payment is a real thing that happens. El mes
              entra en la key porque cambiar `?mes=` no remonta el
              formulario: sin eso, la fecha prellenada seguiría siendo la
              del mes anterior después de navegar. */}
          <Field key={`period-${selectedPlan.id}-${firstOfMonth}`}>
            <Label htmlFor="periodStart">Período desde</Label>
            <Input
              id="periodStart"
              name="periodStart"
              type="date"
              defaultValue={selectedPlan.periodStart ?? firstOfMonth}
              required
            />
          </Field>
          <Field key={`period-end-${selectedPlan.id}-${lastOfMonth}`}>
            <Label htmlFor="periodEnd">Período hasta</Label>
            <Input
              id="periodEnd"
              name="periodEnd"
              type="date"
              defaultValue={selectedPlan.periodEnd ?? lastOfMonth}
              required
            />
          </Field>
          <Field key={`amount-${selectedPlan.id}-${suggestion.amount}`}>
            <Label htmlFor="amount">Monto</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              defaultValue={suggestion.amount}
            />
            {suggestion.mode !== "full" ? (
              <FieldHint>Sugerido. Podés escribir otro monto.</FieldHint>
            ) : null}
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

        {longCycle && selectedPlan.periodStart && selectedPlan.periodEnd ? (
          <LongPeriodQuote
            months={longCycle}
            periodStart={selectedPlan.periodStart}
            periodEnd={selectedPlan.periodEnd}
            price={selectedPlan.price}
            proratedPrice={selectedPlan.proratedPrice}
            unitsCharged={selectedPlan.unitsCharged}
            unitsTotal={selectedPlan.unitsTotal}
            mode={suggestion.mode}
            currency={currency}
          />
        ) : null}

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

/**
 * ADR-0031: what a long-cycle plan charges, with the arithmetic in the open
 * -- full period, full price and, when it applies, the prorated suggestion
 * ("1 de 3 meses del trimestre jul–sep"). Every number here comes from
 * `quote_service_plan_period()`; this only words it.
 */
function LongPeriodQuote({
  months,
  periodStart,
  periodEnd,
  price,
  proratedPrice,
  unitsCharged,
  unitsTotal,
  mode,
  currency,
}: {
  months: number;
  periodStart: string;
  periodEnd: string;
  price: number;
  proratedPrice: number;
  unitsCharged: number;
  unitsTotal: number;
  mode: "full" | "prorated" | "plan-change";
  currency: string;
}) {
  const noun = periodNoun(months);
  const range = formatPeriodRange(periodStart, periodEnd);

  return (
    <Alert tone="info" size="sm" title={`Plan de ${months} meses`}>
      <ul className="mt-1 flex flex-col gap-0.5">
        <li>
          Período completo: {noun} {range}
        </li>
        <li>
          Precio completo: <span className="tnum">{formatMoney(price, currency)}</span>
        </li>
        {mode === "prorated" ? (
          <li className="font-medium">
            Sugerido: <span className="tnum">{formatMoney(proratedPrice, currency)}</span> — {unitsCharged} de{" "}
            {unitsTotal} {unitsTotal === 1 ? "mes" : "meses"} del {noun} {range}, porque entra con el {noun} ya
            empezado. La cobertura igual es el {noun} entero.
          </li>
        ) : null}
        {mode === "plan-change" ? (
          <li>
            Ya tiene un pago en este período para este servicio: un cambio de plan se cobra completo, no se
            prorratea. Si querés reconocerle algo, cambiá el monto a mano.
          </li>
        ) : null}
      </ul>
    </Alert>
  );
}

const MAKEUP_ORIGIN_LABEL: Record<string, string> = {
  CUSTOMER_RELEASE: "Liberó a tiempo",
  ORGANIZATION_CANCELLED: "Canceló el negocio",
  MANUAL: "Cortesía",
};

/**
 * ADR-0025: the credits this customer has, and the one door that mints one
 * with no reservation behind it -- gated OWNER-only and audited with a
 * note by grant_manual_makeup_credit() itself, not by hiding the form from
 * STAFF (whoever submits it finds out from the RPC's own error).
 */
export function MakeupCreditsPanel({
  organizationSlug,
  customerId,
  services,
  credits,
  canGrant,
}: {
  organizationSlug: string;
  customerId: string;
  services: Service[];
  credits: CustomerMakeupCredit[];
  /** OWNER-only (ADR-0025, reaffirmed by ADR-0033): not offered to anyone else. */
  canGrant: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    grantManualMakeupCredit.bind(null, organizationSlug, customerId),
    initialState,
  );

  return (
    <div className="flex flex-col gap-3">
      {credits.length === 0 ? (
        <EmptyState size="sm" title="Sin créditos de recupero." />
      ) : (
        <DataList>
          {credits.map((c) => {
            const usable = c.status === "AVAILABLE" && !c.isExpired;
            return (
              <DataListRow key={c.creditId} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{c.serviceName}</span>
                  <span className="text-xs text-muted-foreground">
                    {MAKEUP_ORIGIN_LABEL[c.origin] ?? c.origin}
                    {c.note ? ` · ${c.note}` : ""}
                  </span>
                  <span className="tnum text-xs text-muted-foreground">Vence {c.expiresOn}</span>
                </div>
                <StatusBadge tone={usable ? "success" : c.status === "CONSUMED" ? "neutral" : "danger"}>
                  {usable ? "Disponible" : c.status === "CONSUMED" ? "Usado" : c.status === "REVOKED" ? "Anulado" : "Vencido"}
                </StatusBadge>
              </DataListRow>
            );
          })}
        </DataList>
      )}

      {canGrant ? (
      <form action={formAction} className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
        <p className="text-xs text-muted-foreground">
          Crédito de cortesía: sólo el dueño de la organización puede otorgarlo, y queda auditado con un
          motivo (ADR-0025).
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field className="sm:col-span-2">
            <Label htmlFor="mc-serviceId">Servicio</Label>
            <Select id="mc-serviceId" name="serviceId" required defaultValue={services[0]?.id ?? ""}>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field>
            <Label htmlFor="mc-expiresOn">Vence</Label>
            <Input id="mc-expiresOn" name="expiresOn" type="date" required />
          </Field>
          <Field className="sm:col-span-2">
            <Label htmlFor="mc-note">Motivo</Label>
            <Input id="mc-note" name="note" required placeholder="Por qué se otorga" />
          </Field>
        </div>

        <FormError>{state.error}</FormError>
        <FormSuccess>{state.success}</FormSuccess>

        <Button type="submit" size="sm" variant="outline" disabled={pending}>
          {pending ? "Otorgando…" : "Otorgar crédito"}
        </Button>
      </form>
      ) : null}
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
              href={`/org/${organizationSlug}/plans?serviceId=${service.id}`}
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
  canManage,
}: {
  organizationSlug: string;
  customerId: string;
  payments: Payment[];
  services: Service[];
  /** Every plan of the organization, active or not: a payment outlives the plan's listing. */
  plans: ServicePlan[];
  currency: string;
  /** ADR-0033 `MANAGE_PAYMENTS`: without it the list is read-only (no "Anular"). */
  canManage: boolean;
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
    <DataList>
      {payments.map((p) => {
        const plan = plans.find((candidate) => candidate.id === p.servicePlanId);

        return (
          <DataListRow key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
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
            {canManage && p.status !== "VOID" ? (
              <form action={voidPayment.bind(null, organizationSlug, customerId, p.id)}>
                <Button type="submit" variant="ghost" size="xs">
                  Anular
                </Button>
              </form>
            ) : null}
          </DataListRow>
        );
      })}
    </DataList>
  );
}
