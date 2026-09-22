"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Resource } from "@reservaste/domain";
import { createScheduleRuleGroup, type CreateScheduleRuleState } from "@/app/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Field, FieldHint, FormError } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "cn";
import { WEEKDAY_LETTER, WEEKDAY_LONG } from "@/lib/calendar";

const initialState: CreateScheduleRuleState = { error: null };

// Monday first, Sunday last -- the week as a person reads it, not as
// getDay() numbers it.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

/**
 * One configuration, several days (ADR-0022). Picking Mon/Wed/Fri creates
 * three ScheduleRules sharing a group; the model stays one rule per
 * weekday so exceptions and occurrence generation are untouched, and the
 * person filling this in never has to know that.
 */
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
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [state, formAction, pending] = useActionState(
    createScheduleRuleGroup.bind(null, organizationSlug, serviceId),
    initialState,
  );

  if (resources.length === 0) {
    return (
      <EmptyState
        size="sm"
        title="Necesitás un recurso (sala, profesional, cancha) antes de armar un horario."
        action={
          <Link
            href={`/org/${organizationSlug}/resources`}
            className="focus-ring rounded-md text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Crear recurso
          </Link>
        }
      />
    );
  }

  if (!open) {
    return (
      <Button variant="outline" onClick={() => setOpen(true)} className="self-start">
        + Nuevo horario
      </Button>
    );
  }

  const toggle = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <form action={formAction} className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-card">
      <Field>
        <Label>Días</Label>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((day) => {
            const on = weekdays.includes(day);
            return (
              <button
                key={day}
                type="button"
                onClick={() => toggle(day)}
                aria-pressed={on}
                aria-label={WEEKDAY_LONG[day]}
                title={WEEKDAY_LONG[day]}
                className={cn(
                  "focus-ring size-11 rounded-lg border text-sm font-semibold transition-colors",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
              >
                {WEEKDAY_LETTER[day]}
              </button>
            );
          })}
        </div>
        {weekdays.map((day) => (
          <input key={day} type="hidden" name="weekdays" value={day} />
        ))}
        <FieldHint>
          {weekdays.length === 0
            ? "Elegí al menos un día."
            : `Se crean ${weekdays.length} horario${weekdays.length === 1 ? "" : "s"}, uno por día.`}
        </FieldHint>
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor="localStartTime">Hora de inicio</Label>
          <Input id="localStartTime" name="localStartTime" type="time" defaultValue="09:00" required />
        </Field>
        <Field>
          <Label htmlFor="resourceId">Recurso</Label>
          <Select id="resourceId" name="resourceId" required>
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field>
          <Label htmlFor="durationMinutes">Duración (minutos)</Label>
          <Input id="durationMinutes" name="durationMinutes" type="number" min={1} defaultValue={60} required />
        </Field>
        <Field>
          <Label htmlFor="capacity">Capacidad</Label>
          <Input id="capacity" name="capacity" type="number" min={1} defaultValue={12} required />
        </Field>
      </div>

      <FormError>{state.error}</FormError>

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || weekdays.length === 0}>
          {pending ? "Creando…" : "Crear horario"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
