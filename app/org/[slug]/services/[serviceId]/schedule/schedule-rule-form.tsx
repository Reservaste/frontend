"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Resource } from "@reservaste/domain";
import { createScheduleRule, type CreateScheduleRuleState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: CreateScheduleRuleState = { error: null };

const WEEKDAYS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
];

const selectClass =
  "h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ScheduleRuleForm({
  organizationSlug,
  serviceId,
  resources,
}: {
  organizationSlug: string;
  serviceId: string;
  resources: Resource[];
}) {
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState(1);
  const [state, formAction, pending] = useActionState(
    createScheduleRule.bind(null, organizationSlug, serviceId),
    initialState,
  );

  if (resources.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card/50 px-4 py-4 text-sm">
        <p className="text-muted-foreground">
          Necesitás un recurso (sala, profesional, cancha) antes de armar un horario.
        </p>
        <Link
          href={`/org/${organizationSlug}/resources`}
          className="mt-1 inline-block font-medium text-primary underline-offset-4 hover:underline"
        >
          Crear recurso
        </Link>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Nuevo horario
      </Button>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex flex-col gap-1.5">
        <Label>Día de la semana</Label>
        {/* A row of day toggles instead of a dropdown: picking a weekday is
            the most frequent choice here and deserves one tap. */}
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((day) => (
            <button
              key={day.value}
              type="button"
              onClick={() => setWeekday(day.value)}
              className={`min-w-11 rounded-lg border px-2.5 py-1.5 text-sm font-medium transition-colors ${
                weekday === day.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:bg-muted"
              }`}
            >
              {day.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="weekday" value={weekday} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="localStartTime">Hora de inicio</Label>
          <Input id="localStartTime" name="localStartTime" type="time" defaultValue="09:00" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="resourceId">Recurso</Label>
          <select id="resourceId" name="resourceId" required className={selectClass}>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Duración (minutos)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={1} defaultValue={60} required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="capacity">Capacidad</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={12} required />
        </div>
      </div>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Creando…" : "Crear horario"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
