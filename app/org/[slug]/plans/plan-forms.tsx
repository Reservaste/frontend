"use client";

import { useActionState, useEffect, useState } from "react";
import type { Service, ServicePlanKind } from "@reservaste/domain";
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
  QUOTA_SCOPE_LABEL,
  planBillingLabel,
  planPriceSuffix,
  planScopeLabel,
  planSummary,
} from "@/lib/plan-labels";

const initialState: ActionState = { error: null, success: null };

/**
 * The plan editor, as a dialog on top of the price list.
 *
 * Moved here from `services/[serviceId]/plans/` (pedido del dueño tras
 * ADR-0029: un plan puede cubrir 1, 2, 3 o todos los servicios, así que
 * gestionarlo "adentro" de uno de ellos ya no representa el dominio).
 * Planes es ahora una sección de nivel superior, hermana de Servicios --
 * no hay un "servicio actual" del que partir, el checklist de alcance
 * arranca vacío y el dueño elige explícitamente.
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
  idPrefix,
}: {
  planKind: ServicePlanKind;
  onPlanKindChange?: (value: ServicePlanKind) => void;
  weeklyQuota: number | null;
  billingCycle: string | null;
  /** Terms are frozen: editing an existing plan, always. */
  disabled: boolean;
  idPrefix: string;
}) {
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
          <option value="WEEKLY_QUOTA">{PLAN_KIND_LABEL.WEEKLY_QUOTA} — elegís cuántos</option>
          <option value="UNLIMITED">{PLAN_KIND_LABEL.UNLIMITED} — sin límite en el período</option>
        </Select>
        {planKind === "WEEKLY_QUOTA" ? (
          <FieldHint>
            Los turnos fijos por semana necesitan que cada servicio cubierto exija pago al día: sin
            un pago vigente no hay de dónde leer la frecuencia.
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
            Cuántos horarios fijos puede tener a la vez en los servicios cubiertos. Si tiene más,
            los que sobran quedan pendientes en vez de confirmarse.
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

/**
 * ADR-0029: alcance del plan. Para `DROP_IN` es un único servicio
 * obligatorio (§1.1 -- multi-servicio en un turno suelto sigue fuera de
 * alcance a propósito). Para el resto, un toggle "todos los servicios" y un
 * checklist de servicios puntuales, mutuamente excluyentes (la base los
 * rechaza si se mandan los dos). Sin preselección: quien crea el plan desde
 * esta pantalla elige explícitamente 1, 2, 3 o todos.
 */
function ScopeFields({
  services,
  appliesToAllServices,
  onAppliesToAllServicesChange,
  selectedServiceIds,
  onSelectedServiceIdsChange,
  planKind,
  quotaScope,
  onQuotaScopeChange,
  idPrefix,
}: {
  services: Service[];
  appliesToAllServices: boolean;
  onAppliesToAllServicesChange: (value: boolean) => void;
  selectedServiceIds: string[];
  onSelectedServiceIdsChange: (value: string[]) => void;
  planKind: ServicePlanKind;
  quotaScope: "PER_SERVICE" | "SHARED_ACROSS_SERVICES";
  onQuotaScopeChange: (value: "PER_SERVICE" | "SHARED_ACROSS_SERVICES") => void;
  idPrefix: string;
}) {
  const active = services.filter((s) => s.isActive);

  if (planKind === "DROP_IN") {
    return (
      <Field>
        <Label htmlFor={`${idPrefix}-dropInService`}>Servicio</Label>
        <Select
          id={`${idPrefix}-dropInService`}
          name="serviceIds"
          touch
          required
          value={selectedServiceIds[0] ?? ""}
          onChange={(event) =>
            onSelectedServiceIdsChange(event.target.value ? [event.target.value] : [])
          }
        >
          <option value="">Elegí un servicio…</option>
          {active.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </Select>
        <FieldHint>Un turno suelto cubre exactamente un servicio.</FieldHint>
      </Field>
    );
  }

  const coversMultiple = appliesToAllServices || selectedServiceIds.length > 1;

  return (
    <>
      <Field>
        <div className="flex items-center gap-2">
          <input
            id={`${idPrefix}-appliesToAllServices`}
            name="appliesToAllServices"
            type="checkbox"
            className="size-4"
            checked={appliesToAllServices}
            onChange={(event) => onAppliesToAllServicesChange(event.target.checked)}
          />
          <Label htmlFor={`${idPrefix}-appliesToAllServices`} className="!mb-0">
            Todos los servicios (actuales y futuros)
          </Label>
        </div>
        {appliesToAllServices ? (
          <FieldHint>Este plan va a cubrir automáticamente cualquier servicio nuevo que agregues.</FieldHint>
        ) : (
          <div className="mt-1.5 flex flex-col gap-1.5 rounded-lg border p-2.5">
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no hay servicios activos.</p>
            ) : (
              active.map((service) => (
                <label key={service.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="serviceIds"
                    value={service.id}
                    className="size-4"
                    checked={selectedServiceIds.includes(service.id)}
                    onChange={(event) => {
                      onSelectedServiceIdsChange(
                        event.target.checked
                          ? [...selectedServiceIds, service.id]
                          : selectedServiceIds.filter((id) => id !== service.id),
                      );
                    }}
                  />
                  {service.name}
                </label>
              ))
            )}
          </div>
        )}
      </Field>

      {planKind === "WEEKLY_QUOTA" && coversMultiple ? (
        <Field>
          <Label htmlFor={`${idPrefix}-quotaScope`}>Cómo se reparte la cuota</Label>
          <Select
            id={`${idPrefix}-quotaScope`}
            name="quotaScope"
            touch
            value={quotaScope}
            onChange={(event) => onQuotaScopeChange(event.target.value as typeof quotaScope)}
          >
            <option value="PER_SERVICE">{QUOTA_SCOPE_LABEL.PER_SERVICE}</option>
            <option value="SHARED_ACROSS_SERVICES">{QUOTA_SCOPE_LABEL.SHARED_ACROSS_SERVICES}</option>
          </Select>
          <FieldHint>
            {quotaScope === "PER_SERVICE"
              ? "Ej.: 2 por semana en cada servicio cubierto."
              : "Ej.: 2 por semana en total, repartidos entre los servicios cubiertos."}
          </FieldHint>
        </Field>
      ) : null}
    </>
  );
}

export function NewPlanDialog({
  organizationSlug,
  services,
  currency,
  canEdit,
  variant = "default",
}: {
  organizationSlug: string;
  /** Every service of the organization, for the "varios servicios" checklist (ADR-0029). */
  services: Service[];
  /** ISO 4217 of the organization (ADR-0024): the plan has no currency of its own. */
  currency: string;
  canEdit: boolean;
  /** `default` for the header button, `outline` inside an empty state. */
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [planKind, setPlanKind] = useState<ServicePlanKind>("WEEKLY_QUOTA");
  const [appliesToAllServices, setAppliesToAllServices] = useState(false);
  // Sin preselección (pedido explícito del dueño): el checklist arranca
  // vacío, no hay un "servicio actual" del que partir.
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [quotaScope, setQuotaScope] = useState<"PER_SERVICE" | "SHARED_ACROSS_SERVICES">("PER_SERVICE");
  const [state, formAction, pending] = useActionState(
    createServicePlan.bind(null, organizationSlug),
    initialState,
  );

  useCloseOnSuccess(state, () => setOpen(false));

  if (!canEdit) return null;

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) {
          // Reset every time it opens, not just on mount -- Dialog unmounts
          // its content on close, but this keeps the reset explicit and
          // independent of that implementation detail.
          setPlanKind("WEEKLY_QUOTA");
          setAppliesToAllServices(false);
          setSelectedServiceIds([]);
          setQuotaScope("PER_SERVICE");
        }
      }}
    >
      <DialogTrigger render={<Button variant={variant} size="touch" />}>Crear plan</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo plan</DialogTitle>
          <DialogDescription>
            Un plan es un precio y lo que ese precio da. Elegí qué servicios cubre: uno, varios o
            todos.
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
          />

          <ScopeFields
            idPrefix="new"
            services={services}
            appliesToAllServices={appliesToAllServices}
            onAppliesToAllServicesChange={setAppliesToAllServices}
            selectedServiceIds={selectedServiceIds}
            onSelectedServiceIdsChange={setSelectedServiceIds}
            planKind={planKind}
            quotaScope={quotaScope}
            onQuotaScopeChange={setQuotaScope}
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
  plan,
  currency,
  serviceNameById,
}: {
  organizationSlug: string;
  plan: ServicePlanWithUsage;
  currency: string;
  /** ADR-0029: to render the frozen scope ("Pilates + Musculación"). */
  serviceNameById: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateServicePlan.bind(null, organizationSlug, plan.id),
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
            <Field>
              <Label>Alcance</Label>
              <p className="text-sm text-muted-foreground">
                {planScopeLabel(plan.appliesToAllServices, plan.serviceIds, serviceNameById)}
                {plan.quotaScope ? ` · ${QUOTA_SCOPE_LABEL[plan.quotaScope]}` : ""}
              </p>
            </Field>
            <Alert tone="info" size="sm">
              {plan.paymentCount > 0 ? (
                <>
                  Este plan ya tiene {plan.paymentCount}{" "}
                  {plan.paymentCount === 1 ? "pago registrado" : "pagos registrados"}, así que qué
                  da y con qué frecuencia no se pueden cambiar: un pago vigente tiene que poder
                  seguir resolviendo sus términos.{" "}
                </>
              ) : (
                <>Qué da un plan, con qué frecuencia y qué servicios cubre no se editan. </>
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
  plan,
  currency,
  canEdit,
  serviceNameById,
}: {
  organizationSlug: string;
  plan: ServicePlanWithUsage;
  currency: string;
  canEdit: boolean;
  /** ADR-0029: to render the scope ("Pilates + Musculación") next to the plan. */
  serviceNameById: Record<string, string>;
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
              Cubre: {planScopeLabel(plan.appliesToAllServices, plan.serviceIds, serviceNameById)}
              {plan.quotaScope ? ` · ${QUOTA_SCOPE_LABEL[plan.quotaScope]}` : ""}
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
              plan={plan}
              currency={currency}
              serviceNameById={serviceNameById}
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
                <form action={setServicePlanActive.bind(null, organizationSlug, plan.id, false)}>
                  <Button type="submit" variant="destructive" size="touch" className="w-full">
                    Sí, desactivar
                  </Button>
                </form>
              </ConfirmDialog>
            ) : (
              <form action={setServicePlanActive.bind(null, organizationSlug, plan.id, true)}>
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
