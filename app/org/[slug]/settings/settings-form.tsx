"use client";

import { useActionState } from "react";
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

export function SettingsForm({
  organizationSlug,
  organization,
  canEdit,
}: {
  organizationSlug: string;
  organization: Organization;
  canEdit: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    updateOrganizationSettings.bind(null, organizationSlug),
    initialState,
  );

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
