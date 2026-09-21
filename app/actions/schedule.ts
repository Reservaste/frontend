"use server";

import { revalidatePath } from "next/cache";
import { createScheduleRuleSchema, mapScheduleRule, mapSlotOccurrence } from "@reservaste/domain";
import { createClient } from "@/lib/supabase/server";
import { requireOrganizationMembership } from "@/app/actions/organizations";

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


export interface ScheduleRuleGroup {
  groupId: string;
  resourceId: string;
  resourceName: string;
  localStartTime: string;
  durationMinutes: number;
  capacity: number;
  weekdays: number[];
  ruleIds: string[];
}

/**
 * The grouped shape the schedule screen renders (ADR-0022): "Lun/Mié/Vie
 * 09:00" is one row here and still one ScheduleRule per weekday
 * underneath, which is what keeps exceptions and occurrence generation
 * unchanged.
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
      local_start_time: string;
      duration_minutes: number;
      capacity: number;
      weekdays: number[];
      rule_ids: string[];
    }) => ({
      groupId: row.group_id,
      resourceId: row.resource_id,
      resourceName: row.resource_name,
      localStartTime: row.local_start_time,
      durationMinutes: row.duration_minutes,
      capacity: row.capacity,
      weekdays: row.weekdays,
      ruleIds: row.rule_ids,
    }),
  );
}

export async function createScheduleRuleGroup(
  organizationSlug: string,
  serviceId: string,
  _prevState: CreateScheduleRuleState,
  formData: FormData,
): Promise<CreateScheduleRuleState> {
  await requireOrganizationMembership(organizationSlug);

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
    return { error: "No se pudo crear el horario" };
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
