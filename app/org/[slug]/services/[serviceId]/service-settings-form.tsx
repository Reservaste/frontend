"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Service } from "@reservaste/domain";
import { updateServiceSettings, type ServiceSettingsState } from "@/app/actions/services";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { cn } from "cn";

const initialState: ServiceSettingsState = { error: null, success: null };

const PRESETS = ["#0067e1", "#0f766e", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"];

/**
 * Configuration of a service that isn't its price (ADR-0024).
 *
 * The price, the billing period and how the month is counted used to be
 * here and are now in the top-level Planes section, on `service_plans`
 * (ADR-0029 moved it out of a per-service tab: a plan can cover several
 * services). A service has
 * several simultaneous prices (a single slot, two a week, three a week),
 * which a single set of columns on the Service could not express, and
 * having both would be two sources of truth for "what period does a
 * payment buy".
 *
 * What stays is the switch that isn't a price -- whether a payment
 * covering the slot's date is required to book -- plus the colour the
 * calendar uses to tell this service apart.
 *
 * Was `billing-form.tsx` until ADR-0024 moved the price to the plan: what
 * stays on the Service is whether it demands payment at all, not how much.
 */
export function ServiceSettingsForm({
  organizationSlug,
  service,
  canEdit,
}: {
  organizationSlug: string;
  service: Service;
  canEdit: boolean;
}) {
  const [color, setColor] = useState(service.color ?? "");
  const [state, formAction, pending] = useActionState(
    updateServiceSettings.bind(null, organizationSlug, service.id),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-base">Configuración del servicio</h2>
        <p className="text-sm text-muted-foreground">
          Si hace falta estar al día para reservarlo, y cómo se lo distingue en la agenda. Los
          precios viven en{" "}
          <Link
            href={`/org/${organizationSlug}/plans?serviceId=${service.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Planes
          </Link>
          .
        </p>
      </div>

      <label className="flex w-fit items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="paymentRequired"
          defaultChecked={service.paymentRequired}
          disabled={!canEdit}
          className="focus-ring mt-0.5 size-4 accent-primary"
        />
        <span>
          Exigir pago al día para reservar
          <span className="block text-xs text-muted-foreground">
            Si está apagado, podés registrar los pagos igual pero nadie queda bloqueado. Los planes
            de turnos fijos por semana necesitan que esté encendido.
          </span>
        </span>
      </label>

      <Field className="border-t pt-4">
        <Label>Color en el calendario</Label>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={color || "#0067e1"}
            disabled={!canEdit}
            onChange={(event) => setColor(event.target.value)}
            className="focus-ring size-9 cursor-pointer rounded-lg border bg-card p-1"
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
                "focus-ring size-7 rounded-full border transition-transform hover:scale-110",
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
        <FieldHint>Sirve para distinguir este servicio de un vistazo en la agenda.</FieldHint>
      </Field>

      <FormError>{state.error}</FormError>
      <FormSuccess>{state.success}</FormSuccess>

      <Button type="submit" size="sm" className="self-start" disabled={!canEdit || pending}>
        {pending ? "Guardando…" : "Guardar configuración"}
      </Button>

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">
          Solo el dueño puede cambiar la configuración de cobro.
        </p>
      ) : null}
    </form>
  );
}
