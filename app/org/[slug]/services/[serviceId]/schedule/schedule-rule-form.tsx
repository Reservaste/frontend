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
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetBody,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { CheckIcon } from "@/components/icons";
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
 *
 * A `Sheet` instead of expanding in place, same gesture as `EnrollForm` /
 * `InviteForm`: a phone gets a real bottom sheet with a thumb-reachable
 * footer instead of the page reflowing under a form that pushes the list
 * of existing horarios down.
 *
 * The fields are grouped by the question they answer -- "Cuándo" (días +
 * hora) and "Dónde y cuántos" (recurso + duración + capacidad) -- instead
 * of one flat list, so filling it in follows the same two decisions a
 * person actually makes, in order.
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

  const toggle = (day: number) =>
    setWeekdays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );

  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="touch" className="self-start" />}>
        + Nuevo horario
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Nuevo horario</SheetTitle>
          <SheetDescription>
            Se crea un turno automático por semana, para cada día que elijas.
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <form id="schedule-rule-form" action={formAction} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
              <span className="eyebrow text-muted-foreground">Cuándo</span>
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
                          "focus-ring relative flex size-11 items-center justify-center rounded-lg border-2 text-sm font-semibold transition-colors",
                          on
                            ? "border-primary bg-primary text-primary-foreground shadow-card"
                            : "border-border bg-card text-muted-foreground hover:border-foreground/25 hover:text-foreground",
                        )}
                      >
                        {WEEKDAY_LETTER[day]}
                        {/* The check is the state signal, not the colour --
                            picking one day and the day next to it apart has
                            to work for someone who can't tell primary blue
                            from grey at a glance. */}
                        {on ? (
                          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-card ring-1 ring-primary">
                            <CheckIcon className="size-2.5 text-primary" />
                          </span>
                        ) : null}
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
              <Field>
                <Label htmlFor="schedule-rule-time">Hora de inicio</Label>
                <Input
                  id="schedule-rule-time"
                  name="localStartTime"
                  type="time"
                  touch
                  defaultValue="09:00"
                  required
                />
              </Field>
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <span className="eyebrow text-muted-foreground">Dónde y cuántos</span>
              <Field>
                <Label htmlFor="schedule-rule-resource">Recurso</Label>
                <Select id="schedule-rule-resource" name="resourceId" touch required>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <Label htmlFor="schedule-rule-duration">Duración (min)</Label>
                  <Input
                    id="schedule-rule-duration"
                    name="durationMinutes"
                    type="number"
                    touch
                    min={1}
                    defaultValue={60}
                    required
                  />
                </Field>
                <Field>
                  <Label htmlFor="schedule-rule-capacity">Capacidad</Label>
                  <Input
                    id="schedule-rule-capacity"
                    name="capacity"
                    type="number"
                    touch
                    min={1}
                    defaultValue={12}
                    required
                  />
                </Field>
              </div>
            </div>

            <FormError>{state.error}</FormError>
          </form>
        </SheetBody>
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>Cerrar</SheetClose>
          <Button
            type="submit"
            form="schedule-rule-form"
            size="touch"
            disabled={pending || weekdays.length === 0}
          >
            {pending ? "Creando…" : "Crear horario"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
