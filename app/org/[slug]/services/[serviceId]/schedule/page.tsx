import Link from "next/link";
import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listResources } from "@/app/actions/resources";
import { listServices } from "@/app/actions/services";
import { discontinueScheduleRuleGroup, listScheduleRuleGroups } from "@/app/actions/schedule";
import { getCustomers } from "@/app/actions/admin";
import { listStandingReservations } from "@/app/actions/standing";
import { listOrganizationServicePlans } from "@/app/actions/service-plans";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { InfoIcon } from "@/components/icons";
import { cn } from "cn";
import { WEEKDAY_LETTER, WEEKDAY_SHORT } from "@/lib/calendar";
import { ServiceTabs } from "../service-tabs";
import { ServiceSettingsForm } from "../service-settings-form";
import { ScheduleRuleForm } from "./schedule-rule-form";
import { StandingReservations } from "./standing-reservations";

export const metadata = { title: "Horarios" };

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export default async function ServiceSchedulePage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization, membership, permissions } = await requireOrganizationMembership(slug);
  // ADR-0033 + Fase 34 fix 2: taking a whole schedule down cancels
  // everyone's bookings on it, so `discontinue_schedule_rule*()` requires
  // MANAGE_BOOKINGS -- as do creating/cancelling a standing reservation.
  // Creating or editing a schedule stays open to any member.
  const canManageBookings = hasOrgPermission(permissions, "MANAGE_BOOKINGS");
  const [resources, services, groups, customers, plans] = await Promise.all([
    listResources(slug),
    listServices(slug),
    listScheduleRuleGroups(slug, serviceId),
    getCustomers(slug),
    listOrganizationServicePlans(slug),
  ]);

  // ADR-0029: un plan puede cubrir este servicio explícitamente o por
  // "todos los servicios" -- sin esta referencia, el dueño mirando un
  // servicio no tiene ninguna pista de que tiene planes asociados ni de a
  // dónde ir a gestionarlos, ya que Planes dejó de vivir acá.
  const coveringPlans = plans.filter(
    (plan) => plan.isActive && (plan.appliesToAllServices || plan.serviceIds.includes(serviceId)),
  );

  // Standing reservations subscribe to a single ScheduleRule, so a
  // Mon/Wed/Fri group has three of them -- which is correct: a standing
  // Monday is not a standing Wednesday. ADR-0050: a group's `items` has one
  // entry per real ScheduleRule row (a span group can have several items
  // sharing the same weekday), so this flattens `items`, not a separate
  // `ruleIds` array.
  const standingByRule = Object.fromEntries(
    await Promise.all(
      groups
        .flatMap((group) => group.items.map((item) => item.ruleId))
        .map(async (ruleId) => [ruleId, await listStandingReservations(slug, ruleId)] as const),
    ),
  );

  const service = services.find((s) => s.id === serviceId);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Servicios", href: `/org/${slug}/services` },
          { label: service?.name ?? "Servicio" },
        ]}
      />

      <PageHeader
        title={service?.name ?? "Horarios"}
        description="Cada horario genera turnos automáticamente para los próximos 90 días"
      />

      <ServiceTabs organizationSlug={slug} serviceId={serviceId} />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border bg-surface-sunken px-4 py-3 text-sm">
        <InfoIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-muted-foreground">
          {coveringPlans.length === 0
            ? "Este servicio todavía no tiene planes."
            : `Este servicio tiene ${coveringPlans.length} ${coveringPlans.length === 1 ? "plan" : "planes"}: ${coveringPlans
                .map((plan) => plan.name)
                .join(", ")}.`}
        </span>
        <Link
          href={`/org/${slug}/plans?serviceId=${serviceId}`}
          className="focus-ring shrink-0 rounded-md font-medium text-primary underline-offset-4 hover:underline"
        >
          {coveringPlans.length === 0 ? "Crear un plan" : "Ver todos los planes"}
        </Link>
      </div>

      {service ? (
        <ServiceSettingsForm
          organizationSlug={slug}
          service={service}
          canEdit={membership.role === "OWNER"}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base">Horarios</h2>
        <ScheduleRuleForm organizationSlug={slug} serviceId={serviceId} resources={resources} />
      </div>

      {groups.length === 0 ? (
        <EmptyState
          title="Sin horarios cargados"
          description="Agregá un horario y los turnos aparecen solos en la agenda."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => {
            // ADR-0050: `items` carries one real (ruleId, weekday,
            // localStartTime) per row -- a "franja" group (ADR-0045) can
            // have several items that share a weekday but differ in
            // localStartTime, so the day badges and the headline time both
            // derive from `items` instead of a separate weekdays[]/
            // localStartTime pair that could disagree with it.
            const weekdaysInGroup = new Set(group.items.map((item) => item.weekday));
            const distinctTimes = Array.from(
              new Set(group.items.map((item) => item.localStartTime)),
            ).sort();
            const timeLabel =
              distinctTimes.length === 1
                ? distinctTimes[0]!.slice(0, 5)
                : `${distinctTimes[0]!.slice(0, 5)}–${distinctTimes[distinctTimes.length - 1]!.slice(0, 5)}`;
            // sr-only full description: every real (día, hora) pair, never
            // collapsed to one shared value -- the exact thing ADR-0050
            // fixed for the visible rows below.
            const label = group.items
              .map((item) => `${WEEKDAY_SHORT[item.weekday]} ${item.localStartTime.slice(0, 5)}`)
              .join(", ");

            return (
              <li key={group.groupId} className="overflow-hidden rounded-xl border bg-card shadow-card">
                <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                  {/* Day + hour lead: picking a horario is picking a time,
                      same hierarchy the calendar itself uses. Resource and
                      duration are context, not the headline. */}
                  <div className="flex items-center gap-3">
                    <div aria-hidden className="flex shrink-0 gap-1">
                      {WEEK_ORDER.map((day) => (
                        <span
                          key={day}
                          className={cn(
                            "flex h-7 min-w-7 items-center justify-center rounded-md px-1 text-[0.65rem] font-semibold",
                            weekdaysInGroup.has(day)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground/40",
                          )}
                        >
                          {WEEKDAY_LETTER[day]}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-col">
                      <span className="tnum text-lg leading-tight font-semibold">{timeLabel}</span>
                      <span className="text-xs text-muted-foreground">
                        {group.resourceName} · {group.durationMinutes} min
                        {distinctTimes.length > 1
                          ? ` · ${group.items.length} horarios`
                          : ""}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 sm:justify-end">
                    <StatusBadge tone="primary">{group.capacity} lugares</StatusBadge>
                    {canManageBookings ? (
                      <form action={discontinueScheduleRuleGroup.bind(null, slug, serviceId, group.groupId)}>
                        <Button type="submit" variant="ghost" size="sm">
                          Quitar
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>

                {group.items.map((item) => (
                  <StandingReservations
                    key={item.ruleId}
                    organizationSlug={slug}
                    serviceId={serviceId}
                    scheduleRuleId={item.ruleId}
                    ruleLabel={`${WEEKDAY_SHORT[item.weekday]} ${item.localStartTime.slice(0, 5)}`}
                    customers={customers}
                    reservations={standingByRule[item.ruleId] ?? []}
                    timezone={organization.timezone}
                    canManage={canManageBookings}
                  />
                ))}

                <span className="sr-only">{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
