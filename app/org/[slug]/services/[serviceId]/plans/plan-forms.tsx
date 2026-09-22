"use client";

import { useActionState, useEffect, useState } from "react";
import type { ServicePlanKind } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import {
  createServicePlan,
  setServicePlanActive,
  updateServicePlan,
  type ServicePlanWithUsage,
} from "@/app/actions/service-plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status";
import { DataListRow } from "@/components/ui/table";
import { Field, FieldHint, FormError } from "@/components/ui/form";
import {
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";
import {
  BILLING_CYCLE_LABEL,
  PLAN_KIND_LABEL,
  planBillingLabel,
  planPriceSuffix,
  planSummary,
} from "@/lib/plan-labels";

const initialState: ActionState = { error: null, success: null };

/**
 * The plan editor, as a dialog on top of the price list.
 *
 * The shape of the form is `service-settings-form.tsx`'s: a `Select` that reveals a
 * second field. `plan_kind === "WEEKLY_QUOTA"` reveals `weekly_quota`, and
 * `DROP_IN` hides the monthly cycle because a one-off payment has no month
 * to count. The coherence CHECK lives in the database (ADR-0024) -- the
 * form only reveals the field.
 */

/** Closes a dialog the turn its action reports success. */
function useCloseOnSuccess(state: ActionState, close: () => void): void {
  // Keyed on the state object, not on the message: two successful saves in
  // a row produce the same string, and comparing strings would leave the
  // dialog open the second time.
  useEffect(() => {
    if (state.success) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
}

function PlanKindFields({
  planKind,
  onPlanKindChange,
  weeklyQuota,
  billingCycle,
  disabled,
  paymentRequired,
  idPrefix,
}: {
  planKind: ServicePlanKind;
  onPlanKindChange?: (value: ServicePlanKind) => void;
  weeklyQuota: number | null;
  billingCycle: string | null;
  /** Terms are frozen: editing an existing plan, always. */
  disabled: boolean;
  /**
   * Whether the service demands payment. A quota plan on a service that
   * doesn't is rejected by trigger (SERVICE_NOT_PAYMENT_REQUIRED), so the
   * option is closed off here *with the reason*. Irrelevant when the whole
   * block is already disabled, hence the default.
   */
  paymentRequired?: boolean;
  idPrefix: string;
}) {
  const quotaBlocked = !disabled && paymentRequired === false;

  return (
    <>
      <Field>
        <Label htmlFor={`${idPrefix}-planKind`}>Qué da</Label>
        <Select
          id={`${idPrefix}-planKind`}
          name="planKind"
          touch
          value={planKind}
          disabled={disabled}
          onChange={(event) => onPlanKindChange?.(event.target.value as ServicePlanKind)}
        >
          <option value="DROP_IN">{PLAN_KIND_LABEL.DROP_IN} — se paga cada vez</option>
          <option value="WEEKLY_QUOTA" disabled={quotaBlocked}>
            {PLAN_KIND_LABEL.WEEKLY_QUOTA} — elegís cuántos
          </option>
          <option value="UNLIMITED">{PLAN_KIND_LABEL.UNLIMITED} — sin límite en el período</option>
        </Select>
        {quotaBlocked ? (
          <FieldHint>
            Los turnos fijos por semana necesitan que el servicio exija pago al día: sin un pago
            vigente no hay de dónde leer la frecuencia. Activalo en la configuración del servicio,
            en la pestaña Horarios.
          </FieldHint>
        ) : null}
      </Field>

      {planKind === "WEEKLY_QUOTA" ? (
        <Field>
          <Label htmlFor={`${idPrefix}-weeklyQuota`}>Turnos fijos por semana</Label>
          <Input
            id={`${idPrefix}-weeklyQuota`}
            name="weeklyQuota"
            type="number"
            min={1}
            step="1"
            touch
            defaultValue={weeklyQuota ?? 1}
            disabled={disabled}
            required
          />
          <FieldHint>
            Cuántos horarios fijos puede tener a la vez en este servicio. Si tiene más, los que
            sobran quedan pendientes en vez de confirmarse.
          </FieldHint>
        </Field>
      ) : null}

      {planKind !== "DROP_IN" ? (
        <Field>
          <Label htmlFor={`${idPrefix}-billingCycle`}>Cómo se cuenta el mes</Label>
          <Select
            id={`${idPrefix}-billingCycle`}
            name="billingCycle"
            touch
            defaultValue={billingCycle ?? "CALENDAR_MONTH"}
            disabled={disabled}
          >
            <option value="CALENDAR_MONTH">{BILLING_CYCLE_LABEL.CALENDAR_MONTH}</option>
            <option value="ROLLING_MONTH">{BILLING_CYCLE_LABEL.ROLLING_MONTH}</option>
          </Select>
        </Field>
      ) : null}
    </>
  );
}

export function NewPlanDialog({
  organizationSlug,
  serviceId,
  paymentRequired,
  currency,
  canEdit,
  variant = "default",
}: {
  organizationSlug: string;
  serviceId: string;
  paymentRequired: boolean;
  /** ISO 4217 of the organization (ADR-0024): the plan has no currency of its own. */
  currency: string;
  canEdit: boolean;
  /** `default` for the header button, `outline` inside an empty state. */
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [planKind, setPlanKind] = useState<ServicePlanKind>(
    paymentRequired ? "WEEKLY_QUOTA" : "UNLIMITED",
  );
  const [state, formAction, pending] = useActionState(
    createServicePlan.bind(null, organizationSlug, serviceId),
    initialState,
  );

  useCloseOnSuccess(state, () => setOpen(false));

  if (!canEdit) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger render={<Button variant={variant} size="touch" />}>Crear plan</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo plan</DialogTitle>
          <DialogDescription>
            Un plan es un precio y lo que ese precio da. Un mismo servicio puede tener varios.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3.5">
          <Field>
            <Label htmlFor="new-name">Nombre</Label>
            <Input
              id="new-name"
              name="name"
              touch
              required
              maxLength={120}
              placeholder="Mensual 2 por semana"
              aria-invalid={!!state.error}
            />
            <FieldHint>Es el nombre que vas a ver al registrar un pago.</FieldHint>
          </Field>

          <PlanKindFields
            idPrefix="new"
            planKind={planKind}
            onPlanKindChange={setPlanKind}
            weeklyQuota={null}
            billingCycle={null}
            disabled={false}
            paymentRequired={paymentRequired}
          />

          <Field>
            <Label htmlFor="new-price">Precio</Label>
            <Input
              id="new-price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              touch
              required
              defaultValue=""
            />
            <FieldHint>En {currency}.</FieldHint>
          </Field>

          <Field>
            <Label htmlFor="new-description">Descripción (opcional)</Label>
            <Input id="new-description" name="description" touch maxLength={2000} />
          </Field>

          <FormError>{state.error}</FormError>

          <DialogFooter>
            <Button type="button" variant="ghost" size="touch" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="touch" disabled={pending}>
              {pending ? "Creando…" : "Crear plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlanDialog({
  organizationSlug,
  serviceId,
  plan,
  currency,
}: {
  organizationSlug: string;
  serviceId: string;
  plan: ServicePlanWithUsage;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateServicePlan.bind(null, organizationSlug, serviceId, plan.id),
    initialState,
  );

  useCloseOnSuccess(state, () => setOpen(false));

  return (
    <Dialog open={open} onOpenChange={(value) => setOpen(value)}>
      <DialogTrigger render={<Button variant="outline" size="touch" />}>Editar</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar «{plan.name}»</DialogTitle>
          <DialogDescription>
            El precio se puede cambiar cuando quieras: cada pago guarda el monto con el que se
            cobró, así que cambiarlo no toca nada de lo ya cobrado.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-3.5">
          <Field>
            <Label htmlFor={`name-${plan.id}`}>Nombre</Label>
            <Input
              id={`name-${plan.id}`}
              name="name"
              touch
              required
              maxLength={120}
              defaultValue={plan.name}
              aria-invalid={!!state.error}
            />
          </Field>

          <Field>
            <Label htmlFor={`price-${plan.id}`}>Precio</Label>
            <Input
              id={`price-${plan.id}`}
              name="price"
              type="number"
              min={0}
              step="0.01"
              touch
              required
              defaultValue={plan.price}
            />
            <FieldHint>En {currency}.</FieldHint>
          </Field>

          <Field>
            <Label htmlFor={`description-${plan.id}`}>Descripción (opcional)</Label>
            <Input
              id={`description-${plan.id}`}
              name="description"
              touch
              maxLength={2000}
              defaultValue={plan.description ?? ""}
            />
          </Field>

          {/* The frozen half of the form. Disabled *with* the reason and the
              way out: a disabled field with no explanation is a support
              ticket. ADR-0024, resolution 5. */}
          <div className="flex flex-col gap-3.5 rounded-xl border border-dashed p-3.5">
            <PlanKindFields
              idPrefix={`edit-${plan.id}`}
              planKind={plan.planKind}
              weeklyQuota={plan.weeklyQuota}
              billingCycle={plan.billingCycle}
              disabled
            />
            <Alert tone="info" size="sm">
              {plan.paymentCount > 0 ? (
                <>
                  Este plan ya tiene {plan.paymentCount}{" "}
                  {plan.paymentCount === 1 ? "pago registrado" : "pagos registrados"}, así que qué
                  da y con qué frecuencia no se pueden cambiar: un pago vigente tiene que poder
                  seguir resolviendo sus términos.{" "}
                </>
              ) : (
                <>Qué da un plan y con qué frecuencia no se editan. </>
              )}
              Si te equivocaste, desactivá este plan y creá otro: desactivar no le corta la
              cobertura a nadie que ya haya pagado.
            </Alert>
          </div>

          <FormError>{state.error}</FormError>

          <DialogFooter>
            <Button type="button" variant="ghost" size="touch" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" size="touch" disabled={pending}>
              {pending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One plan, as a card on a phone and a divided row from `sm` up
 * (`DataList`). Not a `Table`: the owner opens this from the phone, and a
 * four-column table at 390px is a horizontal scroller nobody scrolls.
 */
export function PlanRow({
  organizationSlug,
  serviceId,
  plan,
  currency,
  canEdit,
}: {
  organizationSlug: string;
  serviceId: string;
  plan: ServicePlanWithUsage;
  currency: string;
  canEdit: boolean;
}) {
  return (
    <DataListRow className={plan.isActive ? undefined : "opacity-75"}>
      <div className="flex flex-col gap-3 px-4 py-3.5">
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
          <div className="flex min-w-0 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{plan.name}</span>
              {plan.isActive ? (
                <StatusBadge tone="success">Activo</StatusBadge>
              ) : (
                <StatusBadge tone="neutral">Desactivado</StatusBadge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {planSummary(plan.planKind, plan.weeklyQuota)}
            </span>
            <span className="text-xs text-muted-foreground">
              {planBillingLabel(plan.billingType, plan.billingCycle)}
              {plan.paymentCount > 0 ? (
                <>
                  {" · "}
                  <span className="tnum">{plan.paymentCount}</span>{" "}
                  {plan.paymentCount === 1 ? "pago" : "pagos"}
                </>
              ) : null}
            </span>
            {plan.description ? (
              <span className="text-xs text-muted-foreground">{plan.description}</span>
            ) : null}
          </div>

          <span className="tnum text-base font-semibold whitespace-nowrap">
            {formatMoney(plan.price, currency)}
            <span className="text-xs font-normal text-muted-foreground">
              {planPriceSuffix(plan.billingType)}
            </span>
          </span>
        </div>

        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <EditPlanDialog
              organizationSlug={organizationSlug}
              serviceId={serviceId}
              plan={plan}
              currency={currency}
            />

            {plan.isActive ? (
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="touch">
                    Desactivar
                  </Button>
                }
                title={`¿Desactivar «${plan.name}»?`}
                description="Deja de ofrecerse para nuevos pagos. Quien ya pagó conserva su cobertura hasta que termine el período: desactivar un plan nunca invalida un pago hecho."
              >
                <form
                  action={setServicePlanActive.bind(
                    null,
                    organizationSlug,
                    serviceId,
                    plan.id,
                    false,
                  )}
                >
                  <Button type="submit" variant="destructive" size="touch" className="w-full">
                    Sí, desactivar
                  </Button>
                </form>
              </ConfirmDialog>
            ) : (
              <form
                action={setServicePlanActive.bind(null, organizationSlug, serviceId, plan.id, true)}
              >
                <Button type="submit" variant="ghost" size="touch">
                  Reactivar
                </Button>
              </form>
            )}
          </div>
        ) : null}
      </div>
    </DataListRow>
  );
}
