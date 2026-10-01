"use server";

import { revalidatePath } from "next/cache";
import { createScheduleRuleSchema, mapScheduleRule, mapSlotOccurrence } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { WEEKDAY_LONG } from "@/lib/calendar";

// ADR-0044: check_schedule_rule_conflicts(), called from
// create_schedule_rule_group() before inserting anything, raises this exact
// shape when the chosen Resource is exclusive and one of the requested
// weekday/hour combinations already has an ACTIVE occurrence from another
// ScheduleRule at an overlapping instant (see `raise exception
// 'RESOURCE_SCHEDULE_CONFLICT: weekday % at % conflicts with an existing
// occurrence starting %'` in
// backend/supabase/migrations/20260930100000_phase42_exclusive_resources.sql).
// Parsed here instead of just showing the raw code so the message names
// which day/hour collides -- if the shape ever changes on the backend side
// this regex simply stops matching and the caller below falls back to a
// still-correct, just less specific, message.
const RESOURCE_SCHEDULE_CONFLICT_RE =
  /RESOURCE_SCHEDULE_CONFLICT: weekday (\d+) at ([\d:]+) conflicts with an existing occurrence starting (.+)$/;

function describeScheduleConflict(message: string, timezone: string): string {
  const match = RESOURCE_SCHEDULE_CONFLICT_RE.exec(message);
  if (!match) {
    return "Ese recurso se ocupa de a uno y ya tiene un turno que se superpone con este horario.";
  }

  const [, weekdayRaw, localStartTimeRaw, conflictStartAtRaw] = match;
  const weekdayName = WEEKDAY_LONG[Number(weekdayRaw)] ?? `día ${weekdayRaw}`;
  const time = localStartTimeRaw.slice(0, 5);

  // Postgres's default ISO DateStyle prints a timestamptz as
  // "YYYY-MM-DD HH:MI:SS+TZ" -- e.g. "...+00", a bare two-digit offset with
  // no colon. `Date`'s parser silently returns Invalid Date for that exact
  // shape (it accepts "+00:00" or "Z" but not "+00"), so the offset needs
  // the colon added back before parsing, not just the space->"T" swap.
  const isoCandidate = conflictStartAtRaw
    .trim()
    .replace(" ", "T")
    .replace(/([+-]\d{2})$/, "$1:00");
  const conflictDate = new Date(isoCandidate);
  if (Number.isNaN(conflictDate.getTime())) {
    return `Ese recurso se ocupa de a uno y ya tiene un turno los ${weekdayName} a las ${time} que se superpone con este horario.`;
  }

  const dateLabel = new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
  }).format(conflictDate);

  return `Ese recurso se ocupa de a uno: ya tiene un turno los ${weekdayName} a las ${time} (el próximo, el ${dateLabel}) que se superpone con este horario.`;
}

export interface CreateScheduleRuleState {
  error: string | null;
}

export async function createScheduleRule(
  organizationSlug: string,
  serviceId: string,
  _prevState: CreateScheduleRuleState,
  formData: FormData,
): Promise<CreateScheduleRuleState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const parsed = createScheduleRuleSchema.safeParse({
    serviceId,
    resourceId: formData.get("resourceId"),
    weekday: formData.get("weekday"),
    localStartTime: formData.get("localStartTime"),
    durationMinutes: formData.get("durationMinutes"),
    capacity: formData.get("capacity"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("schedule_rules").insert({
    organization_id: organization.id,
    service_id: parsed.data.serviceId,
    resource_id: parsed.data.resourceId,
    weekday: parsed.data.weekday,
    local_start_time: parsed.data.localStartTime,
    duration_minutes: parsed.data.durationMinutes,
    capacity: parsed.data.capacity,
    created_by: user?.id,
  });

  if (error) {
    return { error: "No se pudo crear el horario" };
  }

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  return { error: null };
}

export async function listScheduleRules(organizationSlug: string, serviceId: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("schedule_rules")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("service_id", serviceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(mapScheduleRule);
}

export async function listUpcomingOccurrences(organizationSlug: string, serviceId: string) {
  const { organization } = await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("slot_occurrences")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("service_id", serviceId)
    .gte("start_at", new Date().toISOString())
    .order("start_at", { ascending: true })
    .limit(20);

  if (error || !data) {
    return [];
  }

  return data.map(mapSlotOccurrence);
}


export interface ScheduleRuleGroupItem {
  ruleId: string;
  weekday: number;
  localStartTime: string;
}

export interface ScheduleRuleGroup {
  groupId: string;
  resourceId: string;
  resourceName: string;
  durationMinutes: number;
  capacity: number;
  items: ScheduleRuleGroupItem[];
}

/**
 * The grouped shape the schedule screen renders (ADR-0022): "Lun/Mié/Vie
 * 09:00" is one row here and still one ScheduleRule per weekday
 * underneath, which is what keeps exceptions and occurrence generation
 * unchanged.
 *
 * ADR-0050: `items` is one element per real ScheduleRule row
 * (`{ruleId, weekday, localStartTime}`), ordered by
 * (weekday, localStartTime, ruleId) -- never collapsed and never zipped
 * positionally against a separate array. A group created via
 * `create_schedule_rule_span()` (ADR-0045) can have several items that
 * share a `weekday` but differ in `localStartTime`; a group created via
 * `create_schedule_rule_group()` (ADR-0022) has one item per weekday, all
 * sharing the same `localStartTime`. `durationMinutes`/`capacity`/
 * `resourceId`/`resourceName` stay collapsed -- those are constant within
 * a group_id in every insert path that exists today.
 */
export async function listScheduleRuleGroups(
  organizationSlug: string,
  serviceId: string,
): Promise<ScheduleRuleGroup[]> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("schedule_rule_groups", { p_service_id: serviceId });
  if (error || !data) return [];

  return data.map(
    (row: {
      group_id: string;
      resource_id: string;
      resource_name: string;
      duration_minutes: number;
      capacity: number;
      items: ScheduleRuleGroupItem[];
    }) => ({
      groupId: row.group_id,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      durationMinutes: row.duration_minutes,
      capacity: row.capacity,
      items: row.items,
    }),
  );
}

export async function createScheduleRuleGroup(
  organizationSlug: string,
  serviceId: string,
  _prevState: CreateScheduleRuleState,
  formData: FormData,
): Promise<CreateScheduleRuleState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  if (weekdays.length === 0) {
    return { error: "Elegí al menos un día" };
  }

  const resourceId = String(formData.get("resourceId") ?? "");
  const localStartTime = String(formData.get("localStartTime") ?? "");
  const durationMinutes = Number(formData.get("durationMinutes"));
  const capacity = Number(formData.get("capacity"));

  if (!resourceId || !localStartTime) {
    return { error: "Completá el recurso y la hora" };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    return { error: "La duración tiene que ser mayor a 0" };
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "La capacidad tiene que ser mayor a 0" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_schedule_rule_group", {
    p_service_id: serviceId,
    p_resource_id: resourceId,
    p_weekdays: weekdays,
    p_local_start_time: localStartTime,
    p_duration_minutes: durationMinutes,
    p_capacity: capacity,
  });

  if (error) {
    if (error.message.includes("RESOURCE_SCHEDULE_CONFLICT")) {
      return { error: describeScheduleConflict(error.message, organization.timezone) };
    }
    return { error: "No se pudo crear el horario" };
  }

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);
  return { error: null };
}

// ADR-0045: create_schedule_rule_span() raises one of these before
// touching the database (see backend/supabase/migrations/
// 20260930120000_phase43_schedule_rule_spans.sql). Checked in order of
// least- to most-specific so a message that happens to contain more than
// one of these substrings (it never should, they're mutually exclusive)
// still resolves to something sensible.
function describeScheduleRuleSpanError(message: string, timezone: string): string {
  if (message.includes("RESOURCE_SCHEDULE_CONFLICT")) {
    return describeScheduleConflict(message, timezone);
  }
  if (message.includes("STEP_TOO_SHORT")) {
    return "El intervalo entre turnos tiene que ser de al menos 5 minutos.";
  }
  if (message.includes("TOO_MANY_START_TIMES")) {
    return "Esa franja genera demasiados horarios por día (máximo 96) — achicá el rango o agrandá el intervalo.";
  }
  if (message.includes("TOO_MANY_SCHEDULE_RULES")) {
    return "Esa franja genera demasiados horarios en total (máximo 672) — achicá el rango, los días, o agrandá el intervalo.";
  }
  if (message.includes("SPAN_SELF_OVERLAP_ON_EXCLUSIVE_RESOURCE")) {
    return "Con este recurso (se ocupa de a uno) el intervalo tiene que ser igual o mayor a la duración del turno, si no los turnos se pisarían entre sí.";
  }
  if (message.includes("EXCLUSIVE_RESOURCE_CAPACITY_MUST_BE_ONE")) {
    return "Este recurso se ocupa de a uno — la capacidad tiene que ser 1.";
  }
  if (message.includes("RANGE_TOO_SHORT")) {
    return "Ningún turno entra en ese rango con esa duración -- probá un rango más amplio o una duración más corta.";
  }
  if (message.includes("INVALID_RANGE")) {
    return "El horario de fin tiene que ser posterior al de inicio.";
  }
  return "No se pudo crear el horario";
}

export async function createScheduleRuleSpan(
  organizationSlug: string,
  serviceId: string,
  _prevState: CreateScheduleRuleState,
  formData: FormData,
): Promise<CreateScheduleRuleState> {
  const { organization } = await requireOrganizationMembership(organizationSlug);

  const weekdays = formData
    .getAll("weekdays")
    .map((value) => Number(value))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  if (weekdays.length === 0) {
    return { error: "Elegí al menos un día" };
  }

  const resourceId = String(formData.get("resourceId") ?? "");
  const rangeStart = String(formData.get("rangeStart") ?? "");
  const rangeEnd = String(formData.get("rangeEnd") ?? "");
  const stepMinutes = Number(formData.get("stepMinutes"));
  const durationMinutes = Number(formData.get("durationMinutes"));
  const capacity = Number(formData.get("capacity"));

  if (!resourceId || !rangeStart || !rangeEnd) {
    return { error: "Completá el recurso y el rango horario" };
  }
  if (!Number.isInteger(durationMinutes) || durationMinutes < 1) {
    return { error: "La duración tiene que ser mayor a 0" };
  }
  if (!Number.isInteger(capacity) || capacity < 1) {
    return { error: "La capacidad tiene que ser mayor a 0" };
  }
  if (!Number.isInteger(stepMinutes) || stepMinutes < 5) {
    return { error: "El intervalo entre turnos tiene que ser de al menos 5 minutos." };
  }
  if (rangeEnd <= rangeStart) {
    return { error: "El horario de fin tiene que ser posterior al de inicio." };
  }

  const supabase = await createClient();
  const { data: groupId, error } = await supabase.rpc("create_schedule_rule_span", {
    p_service_id: serviceId,
    p_resource_id: resourceId,
    p_weekdays: weekdays,
    p_range_start: rangeStart,
    p_range_end: rangeEnd,
    p_step_minutes: stepMinutes,
    p_duration_minutes: durationMinutes,
    p_capacity: capacity,
  });

  if (error || !groupId) {
    return { error: describeScheduleRuleSpanError(error?.message ?? "", organization.timezone) };
  }

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);
  return { error: null };
}

/** <form action> target, so it resolves to void. */
export async function discontinueScheduleRuleGroup(
  organizationSlug: string,
  serviceId: string,
  groupId: string,
): Promise<void> {
  await requireOrganizationMembership(organizationSlug);
  const supabase = await createClient();

  await supabase.rpc("discontinue_schedule_rule_group", { p_group_id: groupId });

  revalidatePath(`/org/${organizationSlug}/services/${serviceId}/schedule`);
  revalidatePath(`/org/${organizationSlug}/agenda`);
}
