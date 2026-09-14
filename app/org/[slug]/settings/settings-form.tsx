"use client";

import { useActionState } from "react";
import type { Organization } from "@reservaste/domain";
import type { ActionState } from "@/app/actions/admin";
import { updateOrganizationSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    <form action={formAction} className="flex flex-col gap-4 rounded-lg border p-4">
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Nombre</Label>
          <Input id="name" name="name" defaultValue={organization.name} required />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="timezone">Zona horaria</Label>
          <Input id="timezone" name="timezone" defaultValue={organization.timezone} required />
          <p className="text-xs text-muted-foreground">
            Nombre IANA, ej. America/Montevideo. Define en qué horario se muestran y generan los turnos.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="publicAvailabilityDisplay">Disponibilidad pública</Label>
          <select
            id="publicAvailabilityDisplay"
            name="publicAvailabilityDisplay"
            defaultValue={organization.publicAvailabilityDisplay}
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            <option value="EXACT">Mostrar lugares exactos (4 de 12)</option>
            <option value="LIMITED">Mostrar solo si quedan pocos</option>
            <option value="BOOLEAN">Mostrar solo disponible / sin disponibilidad</option>
          </select>
          <p className="text-xs text-muted-foreground">
            Cada servicio puede sobrescribir esto. En capacidades chicas, mostrar el número exacto revela
            cuánta gente hay anotada.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lowAvailabilityPercentage">Umbral &quot;últimos lugares&quot; (%)</Label>
            <Input
              id="lowAvailabilityPercentage"
              name="lowAvailabilityPercentage"
              type="number"
              min={1}
              max={100}
              defaultValue={organization.lowAvailabilityPercentage}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lowAvailabilityFixedCap">Tope fijo (opcional)</Label>
            <Input
              id="lowAvailabilityFixedCap"
              name="lowAvailabilityFixedCap"
              type="number"
              min={1}
              defaultValue={organization.lowAvailabilityFixedCap ?? ""}
            />
          </div>
        </div>

        {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-muted-foreground">{state.success}</p> : null}

        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
      </fieldset>

      {!canEdit ? (
        <p className="text-sm text-muted-foreground">Solo un OWNER puede cambiar la configuración.</p>
      ) : null}
    </form>
  );
}
