"use client";

import { useActionState, useState } from "react";
import type { Service } from "@reservaste/domain";
import { updateServiceBilling, type ServiceBillingState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "cn";

const initialState: ServiceBillingState = { error: null, success: null };

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const PRESETS = ["#0067e1", "#0f766e", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];

/**
 * What the service costs and how its month is counted (ADR-0022).
 *
 * The two cycles are a real difference, not a preference: a gym charges
 * by calendar month, personal training by a month from the day you paid.
 * Which one applies decides whether a payment on the 15th covers the 1st.
 */
export function ServiceBillingForm({
  organizationSlug,
  service,
  canEdit,
}: {
  organizationSlug: string;
  service: Service;
  canEdit: boolean;
}) {
  const [billingType, setBillingType] = useState(service.billingType);
  const [color, setColor] = useState(service.color ?? "");
  const [state, formAction, pending] = useActionState(
    updateServiceBilling.bind(null, organizationSlug, service.id),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-base">Cobro</h2>
        <p className="text-sm text-muted-foreground">
          Cómo se cobra este servicio y si hace falta estar al día para reservarlo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="billingType">Modalidad</Label>
          <select
            id="billingType"
            name="billingType"
            value={billingType}
            disabled={!canEdit}
            onChange={(event) => setBillingType(event.target.value as Service["billingType"])}
            className={selectClass}
          >
            <option value="FREE">Gratuito</option>
            <option value="ONE_TIME">Pago único</option>
            <option value="MONTHLY">Mensual</option>
          </select>
        </div>

        {billingType === "MONTHLY" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="billingCycle">Cómo se cuenta el mes</Label>
            <select
              id="billingCycle"
              name="billingCycle"
              defaultValue={service.billingCycle ?? "CALENDAR_MONTH"}
              disabled={!canEdit}
              className={selectClass}
            >
              <option value="CALENDAR_MONTH">Mes calendario (del 1 al último día)</option>
              <option value="ROLLING_MONTH">Mes desde el pago (30 días corridos)</option>
            </select>
          </div>
        ) : null}

        {billingType !== "FREE" ? (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="price">Precio</Label>
            <Input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={service.price ?? ""}
              disabled={!canEdit}
            />
          </div>
        ) : null}
      </div>

      {billingType !== "FREE" ? (
        <label className="flex w-fit items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="paymentRequired"
            defaultChecked={service.paymentRequired}
            disabled={!canEdit}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            Exigir pago al día para reservar
            <span className="block text-xs text-muted-foreground">
              Si está apagado, podés registrar los pagos igual pero nadie queda bloqueado.
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-col gap-1.5 border-t pt-4">
        <Label>Color en el calendario</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={color || "#0067e1"}
            disabled={!canEdit}
            onChange={(event) => setColor(event.target.value)}
            className="size-9 cursor-pointer rounded-lg border bg-card p-1"
            aria-label="Color del servicio"
          />
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!canEdit}
              onClick={() => setColor(preset)}
              aria-label={`Usar ${preset}`}
              className={cn(
                "size-7 rounded-full border transition-transform hover:scale-110",
                color === preset && "ring-2 ring-ring ring-offset-2",
              )}
              style={{ backgroundColor: preset }}
            />
          ))}
          {color ? (
            <Button type="button" variant="ghost" size="xs" onClick={() => setColor("")} disabled={!canEdit}>
              Quitar
            </Button>
          ) : null}
        </div>
        <input type="hidden" name="color" value={color} />
        <p className="text-xs text-muted-foreground">
          Sirve para distinguir este servicio de un vistazo en la agenda.
        </p>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-success">{state.success}</p> : null}

      <Button type="submit" size="sm" className="self-start" disabled={!canEdit || pending}>
        {pending ? "Guardando…" : "Guardar cobro"}
      </Button>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">Solo el dueño puede cambiar el cobro.</p>
      ) : null}
    </form>
  );
}
