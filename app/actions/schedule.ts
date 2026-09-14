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
