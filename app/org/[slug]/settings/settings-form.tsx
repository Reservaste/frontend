"use client";

import { useActionState, useState } from "react";
import type { Organization } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import { updateOrganizationSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TimezonePicker } from "@/components/timezone-picker";
import { Field, FieldHint, FormError, FormSuccess } from "@/components/ui/form";
import { Select } from "@/components/ui/select";

const initialState: ActionState = { error: null, success: null };

/**
 * ADR-0025: la política de crédito de recupero. No viaja en `Organization`
 * (no está en `mapOrganization()`), así que la página la lee aparte y la
 * pasa acá.
 */
export interface MakeupCreditSettings {
  enabled: boolean;
  releaseDeadlineHours: number;
  expiry: "END_OF_MONTH" | "END_OF_BILLING_PERIOD" | "DAYS_AFTER";
  expiryDays: number | null;
}

export function SettingsForm({
  organizationSlug,
  organization,
  makeup,
  canEdit,
}: {
  organizationSlug: string;
  organization: Organization;
  makeup: MakeupCreditSettings;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationSettings.bind(null, organizationSlug),
    initialState,
  );

  // Controlado, no `defaultChecked`: un checkbox desmarcado no viaja en el
  // FormData, y la acción decide campo por campo con `formData.has(...)`
  // para no pisar la configuración de un formulario que no los manda. Con
  // un checkbox pelado, apagar el crédito sería indistinguible de "esta
  // pantalla no habla del tema" y el interruptor no se podría volver a
  // apagar nunca. El hidden de al lado siempre manda on/off.
  const [makeupEnabled, setMakeupEnabled] = useState(makeup.enabled);
  const [expiry, setExpiry] = useState(makeup.expiry);

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <Field>
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={organization.name} required />
        </Field>

        <Field>
          <TimezonePicker defaultValue={organization.timezone} disabled={!canEdit} />
          <FieldHint>Define en qué horario se muestran y generan los turnos.</FieldHint>
        </Field>

        <Field>
          <Label htmlFor="currency">Moneda</Label>
          <Input
            id="currency"
            name="currency"
            defaultValue={organization.currency}
            required
            maxLength={3}
            autoCapitalize="characters"
            spellCheck={false}
            className="uppercase sm:max-w-32"
          />
          <FieldHint>
            Código de tres letras (UYU, ARS, USD). Es la moneda en la que se muestran
            los precios de todos tus planes y pagos.
          </FieldHint>
        </Field>

        <Field>
          <Label htmlFor="publicAvailabilityDisplay">Disponibilidad pública</Label>
          <Select
            id="publicAvailabilityDisplay"
            name="publicAvailabilityDisplay"
            defaultValue={organization.publicAvailabilityDisplay}
          >
            <option value="EXACT">Mostrar lugares exactos (4 de 12)</option>
            <option value="LIMITED">Mostrar solo si quedan pocos</option>
            <option value="BOOLEAN">Mostrar solo disponible / sin disponibilidad</option>
          </Select>
          <FieldHint>
            Cada servicio puede sobrescribir esto. En capacidades chicas, mostrar el número exacto revela
            cuánta gente hay anotada.
          </FieldHint>
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field>
            <Label htmlFor="lowAvailabilityPercentage">Umbral &quot;últimos lugares&quot; (%)</Label>
            <Input
              id="lowAvailabilityPercentage"
              name="lowAvailabilityPercentage"
              type="number"
              min={1}
              max={100}
              defaultValue={organization.lowAvailabilityPercentage}
            />
          </Field>
          <Field>
            <Label htmlFor="lowAvailabilityFixedCap">Tope fijo (opcional)</Label>
            <Input
              id="lowAvailabilityFixedCap"
              name="lowAvailabilityFixedCap"
              type="number"
              min={1}
              defaultValue={organization.lowAvailabilityFixedCap ?? ""}
            />
          </Field>
        </div>

        {/* ADR-0025 resolución 3: el crédito de recupero es opt-in del
            dueño y hasta acá no había forma de encenderlo desde el
            producto -- el flag quedaba en `false` para toda organización
            real, así que "liberar cupo" cancelaba la fecha y no emitía
            nada. Este bloque es el interruptor que faltaba. */}
        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Crédito de recupero</h2>
            <p className="text-xs text-muted-foreground">
              Qué pasa cuando alguien libera su lugar en un turno al que no va a ir.
            </p>
          </div>

          <input type="hidden" name="makeupCreditsEnabled" value={makeupEnabled ? "on" : "off"} />
          <label className="flex w-full items-start gap-3 rounded-lg px-1 py-2 text-sm transition-colors hover:bg-muted/50">
            <input
              type="checkbox"
              checked={makeupEnabled}
              disabled={!canEdit}
              onChange={(event) => setMakeupEnabled(event.target.checked)}
              className="focus-ring mt-0.5 size-4 shrink-0 accent-primary"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">Dar crédito a quien avisa a tiempo</span>
              <span className="text-xs text-muted-foreground">
                Si está encendido, liberar el lugar con la anticipación de abajo deja un crédito
                para tomar otro turno del mismo servicio. Apagado, liberar sólo cancela la fecha.
              </span>
            </span>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field>
              <Label htmlFor="releaseDeadlineHours">Anticipación mínima (horas)</Label>
              <Input
                id="releaseDeadlineHours"
                name="releaseDeadlineHours"
                type="number"
                min={1}
                max={720}
                required
                defaultValue={makeup.releaseDeadlineHours}
              />
              <FieldHint>
                Con menos aviso que esto el lugar se libera igual, pero sin crédito.
              </FieldHint>
            </Field>

            <Field>
              <Label htmlFor="makeupCreditExpiry">Vencimiento del crédito</Label>
              <Select
                id="makeupCreditExpiry"
                name="makeupCreditExpiry"
                value={expiry}
                onChange={(event) => setExpiry(event.target.value as MakeupCreditSettings["expiry"])}
              >
                <option value="END_OF_MONTH">Fin del mes del turno liberado</option>
                <option value="END_OF_BILLING_PERIOD">Fin del período que pagó</option>
                <option value="DAYS_AFTER">A los N días del turno liberado</option>
              </Select>
              <FieldHint>
                Se cuenta desde la fecha del turno liberado, no desde el día que avisó.
              </FieldHint>
            </Field>

            {expiry === "DAYS_AFTER" ? (
              <Field>
                <Label htmlFor="makeupCreditExpiryDays">Días de vigencia</Label>
                <Input
                  id="makeupCreditExpiryDays"
                  name="makeupCreditExpiryDays"
                  type="number"
                  min={1}
                  max={365}
                  required
                  defaultValue={makeup.expiryDays ?? 30}
                />
              </Field>
            ) : null}
          </div>
        </div>

        <FormError>{state.error}</FormError>
        <FormSuccess>{state.success}</FormSuccess>

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </fieldset>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">Solo el dueño puede cambiar la configuración.</p>
      ) : null}
    </form>
  );
}
