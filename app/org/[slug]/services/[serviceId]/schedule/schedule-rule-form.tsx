"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import type { ResourceWithExclusive } from "@/app/actions/resources";
import {
  createScheduleRuleGroup,
  createScheduleRuleSpan,
  type CreateScheduleRuleState,
} from "@/app/actions/schedule";
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

type Mode = "single" | "span";

/** "09:00" -> 540. `null` for anything that isn't a well-formed HH:MM. */
function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutesAsTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Client-side-only mirror of the server's expansion (ADR-0045:
 * `generate_series(range_start, range_end - duration, step)`, keeping only
 * starts where `start + duration <= range_end`). Purely informative -- the
 * RPC is the one source of truth for what actually gets created, this is
 * just so the person filling the form sees what they're about to create
 * before they submit it.
 */
function computeSpanStarts(
  rangeStart: string,
  rangeEnd: string,
  stepMinutes: number,
  durationMinutes: number,
): string[] {
  const start = parseTimeToMinutes(rangeStart);
  const end = parseTimeToMinutes(rangeEnd);
  if (
    start === null ||
    end === null ||
    end <= start ||
    !Number.isFinite(stepMinutes) ||
    stepMinutes <= 0 ||
    !Number.isFinite(durationMinutes) ||
    durationMinutes <= 0
  ) {
    return [];
  }

  const starts: string[] = [];
  for (let t = start; t + durationMinutes <= end; t += stepMinutes) {
    starts.push(formatMinutesAsTime(t));
  }
  return starts;
}

/**
 * One configuration, several days (ADR-0022), now with a second mode: one
 * configuration, several days AND a whole franja horaria of start times in
 * one shot (ADR-0045) -- picking 10:00-20:00 every 30 minutes on a
 * Mon-Sat barbershop used to mean ~40 separate submits of this same form,
 * one per start time. The toggle switches which server action the form
 * submits to; the "Cuándo"/"Dónde y cuántos" grouping and the days picker
 * are shared by both modes.
 *
 * A `Sheet` instead of expanding in place, same gesture as
 * `ManagedCustomerForm` / `TeamInvitationForm`: a phone gets a real bottom
 * sheet with a thumb-reachable footer instead of the page reflowing under
 * a form that pushes the list of existing horarios down.
 */
export function ScheduleRuleForm({
  organizationSlug,
  serviceId,
  resources,
}: {
  organizationSlug: string;
  serviceId: string;
  resources: ResourceWithExclusive[];
}) {
  const [mode, setMode] = useState<Mode>("single");
  const [weekdays, setWeekdays] = useState<number[]>([1]);
  const [resourceId, setResourceId] = useState(resources[0]?.id ?? "");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [capacity, setCapacity] = useState(12);
  const [rangeStart, setRangeStart] = useState("09:00");
  const [rangeEnd, setRangeEnd] = useState("18:00");
  const [stepMinutes, setStepMinutes] = useState(30);

  const boundAction =
    mode === "span"
      ? createScheduleRuleSpan.bind(null, organizationSlug, serviceId)
      : createScheduleRuleGroup.bind(null, organizationSlug, serviceId);
  const [state, formAction, pending] = useActionState(boundAction, initialState);

  const selectedResource = resources.find((r) => r.id === resourceId);

  const spanStarts = useMemo(
    () =>
      mode === "span" ? computeSpanStarts(rangeStart, rangeEnd, stepMinutes, durationMinutes) : [],
    [mode, rangeStart, rangeEnd, stepMinutes, durationMinutes],
  );
  const spanTotal = spanStarts.length * weekdays.length;

  // Same checks the RPC enforces (ADR-0045), run here only so the person
  // filling the form sees the problem before submitting -- the server is
  // still the one that actually rejects it (CLAUDE.md: never trust the
  // frontend for that).
  const spanWarnings: string[] = [];
  if (mode === "span") {
    if (!Number.isInteger(stepMinutes) || stepMinutes < 5) {
      spanWarnings.push("El intervalo entre turnos tiene que ser de al menos 5 minutos.");
    }
    if (parseTimeToMinutes(rangeEnd) !== null && parseTimeToMinutes(rangeStart) !== null) {
      if (parseTimeToMinutes(rangeEnd)! <= parseTimeToMinutes(rangeStart)!) {
        spanWarnings.push("El horario de fin tiene que ser posterior al de inicio.");
      } else if (spanStarts.length === 0) {
        spanWarnings.push("Con estos valores no entra ningún turno en el rango elegido.");
      }
    }
    if (spanStarts.length > 96) {
      spanWarnings.push(
        "Esa franja genera demasiados horarios por día (máximo 96) — achicá el rango o agrandá el intervalo.",
      );
    }
    if (spanTotal > 672) {
      spanWarnings.push(
        "Esa franja genera demasiados horarios en total (máximo 672) — achicá el rango, los días, o agrandá el intervalo.",
      );
    }
    if (selectedResource?.isExclusive && stepMinutes < durationMinutes) {
      spanWarnings.push(
        "Con este recurso (se ocupa de a uno) el intervalo tiene que ser igual o mayor a la duración del turno, si no los turnos se pisarían entre sí.",
      );
    }
    if (selectedResource?.isExclusive && capacity > 1) {
      spanWarnings.push("Este recurso se ocupa de a uno — la capacidad tiene que ser 1.");
    }
  }

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

  const toggleWeekday = (day: number) =>
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
            {mode === "single"
              ? "Se crea un turno automático por semana, para cada día que elijas."
              : "Se crea un turno automático por cada horario de la franja, para cada día que elijas."}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="mb-1 flex items-center gap-0.5 self-start rounded-lg border border-border/70 bg-surface-sunken p-0.5">
            {(
              [
                { value: "single" as const, label: "Un horario" },
                { value: "span" as const, label: "Franja horaria" },
              ]
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setMode(option.value)}
                aria-pressed={mode === option.value}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm font-medium transition-all",
                  mode === option.value
                    ? "bg-card text-foreground shadow-card"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          <form
            id="schedule-rule-form"
            action={formAction}
            className="flex flex-col gap-4"
          >
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
                        onClick={() => toggleWeekday(day)}
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
                    : mode === "single"
                      ? `Se crean ${weekdays.length} horario${weekdays.length === 1 ? "" : "s"}, uno por día.`
                      : `Se crean ${spanTotal} horario${spanTotal === 1 ? "" : "s"} en total (${spanStarts.length} por día × ${weekdays.length} día${weekdays.length === 1 ? "" : "s"}).`}
                </FieldHint>
              </Field>

              {mode === "single" ? (
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
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3">
                    <Field>
                      <Label htmlFor="schedule-rule-range-start">Desde</Label>
                      <Input
                        id="schedule-rule-range-start"
                        name="rangeStart"
                        type="time"
                        touch
                        value={rangeStart}
                        onChange={(e) => setRangeStart(e.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="schedule-rule-range-end">Hasta</Label>
                      <Input
                        id="schedule-rule-range-end"
                        name="rangeEnd"
                        type="time"
                        touch
                        value={rangeEnd}
                        onChange={(e) => setRangeEnd(e.target.value)}
                        required
                      />
                    </Field>
                    <Field>
                      <Label htmlFor="schedule-rule-step">Cada (min)</Label>
                      <Input
                        id="schedule-rule-step"
                        name="stepMinutes"
                        type="number"
                        touch
                        min={5}
                        step={5}
                        value={stepMinutes}
                        onChange={(e) => setStepMinutes(Number(e.target.value))}
                        required
                      />
                    </Field>
                  </div>

                  {/* Vista previa: sólo informativa, calculada en el cliente
                      -- la RPC create_schedule_rule_span es la única fuente
                      de verdad sobre qué se crea de verdad. */}
                  {spanWarnings.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {spanWarnings.map((warning) => (
                        <FormError key={warning}>{warning}</FormError>
                      ))}
                    </div>
                  ) : spanStarts.length > 0 ? (
                    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-surface-sunken px-3 py-2.5">
                      <span className="text-xs font-medium text-foreground">
                        Vista previa: {spanStarts.length} horario
                        {spanStarts.length === 1 ? "" : "s"} por día
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {spanStarts.slice(0, 16).map((time) => (
                          <span
                            key={time}
                            className="tnum rounded-md bg-card px-1.5 py-0.5 text-xs text-muted-foreground shadow-card"
                          >
                            {time}
                          </span>
                        ))}
                        {spanStarts.length > 16 ? (
                          <span className="self-center text-xs text-muted-foreground">
                            +{spanStarts.length - 16} más
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t pt-4">
              <span className="eyebrow text-muted-foreground">Dónde y cuántos</span>
              <Field>
                <Label htmlFor="schedule-rule-resource">Recurso</Label>
                <Select
                  id="schedule-rule-resource"
                  name="resourceId"
                  touch
                  required
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                >
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                      {r.isExclusive ? " (de a uno)" : ""}
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
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
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
                    value={capacity}
                    onChange={(e) => setCapacity(Number(e.target.value))}
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
            disabled={pending || weekdays.length === 0 || (mode === "span" && spanWarnings.length > 0)}
          >
            {pending ? "Creando…" : "Crear horario"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
