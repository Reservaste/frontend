"use client";

import { useActionState } from "react";
import type { Resource } from "@reservaste/domain";
import { createScheduleRule, type CreateScheduleRuleState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateScheduleRuleState = { error: null };

const WEEKDAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
];

export function ScheduleRuleForm({
  organizationSlug,
  serviceId,
  resources,
}: {
  organizationSlug: string;
  serviceId: string;
  resources: Resource[];
}) {
  const [state, formAction, pending] = useActionState(
    createScheduleRule.bind(null, organizationSlug, serviceId),
    initialState,
  );

  if (resources.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Primero creá un recurso (sala, profesional, etc.) para poder armar un horario.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor="weekday">Día</Label>
          <select id="weekday" name="weekday" required className="h-9 rounded-md border bg-background px-3 text-sm">
            {WEEKDAYS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="resourceId">Recurso</Label>
          <select
            id="resourceId"
            name="resourceId"
            required
            className="h-9 rounded-md border bg-background px-3 text-sm"
          >
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="localStartTime">Hora (local)</Label>
          <Input id="localStartTime" name="localStartTime" type="time" required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="durationMinutes">Duración (min)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={1} defaultValue={60} required />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="capacity">Capacidad</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={12} required />
        </div>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      <Button type="submit" disabled={pending} size="sm">
        {pending ? "Creando..." : "Crear horario"}
      </Button>
    </form>
  );
}
