import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listResources } from "@/app/actions/resources";
import { listServices } from "@/app/actions/services";
import { discontinueScheduleRuleGroup, listScheduleRuleGroups } from "@/app/actions/schedule";
import { getCustomers } from "@/app/actions/admin";
import { listStandingReservations } from "@/app/actions/standing";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { WEEKDAY_SHORT } from "@/lib/calendar";
import { ServiceTabs } from "../service-tabs";
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
  const { organization } = await requireOrganizationMembership(slug);
  const [resources, services, groups, customers] = await Promise.all([
    listResources(slug),
    listServices(slug),
    listScheduleRuleGroups(slug, serviceId),
    getCustomers(slug),
  ]);

  // Standing reservations subscribe to a single ScheduleRule, so a
  // Mon/Wed/Fri group has three of them -- which is correct: a standing
  // Monday is not a standing Wednesday.
  const standingByRule = Object.fromEntries(
    await Promise.all(
      groups
        .flatMap((group) => group.ruleIds)
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

      <ScheduleRuleForm organizationSlug={slug} serviceId={serviceId} resources={resources} />

      {groups.length === 0 ? (
        <EmptyState
          title="Sin horarios cargados"
          description="Agregá un horario y los turnos aparecen solos en la agenda."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {groups.map((group) => {
            const label = `${WEEK_ORDER.filter((d) => group.weekdays.includes(d))
              .map((d) => WEEKDAY_SHORT[d])
              .join(" · ")} ${group.localStartTime.slice(0, 5)}`;

            return (
              <li key={group.groupId} className="overflow-hidden rounded-xl border bg-card shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3.5">
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {WEEK_ORDER.map((day) => (
                        <span
                          key={day}
                          className={`flex size-7 items-center justify-center rounded-md text-xs font-semibold ${
                            group.weekdays.includes(day)
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground/50"
                          }`}
                        >
                          {WEEKDAY_SHORT[day]!.slice(0, 1)}
                        </span>
                      ))}
                      <span className="tnum ml-1.5 font-medium">
                        {group.localStartTime.slice(0, 5)}
                      </span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {group.resourceName} · {group.durationMinutes} min
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <StatusBadge tone="primary">{group.capacity} lugares</StatusBadge>
                    <form action={discontinueScheduleRuleGroup.bind(null, slug, serviceId, group.groupId)}>
                      <Button type="submit" variant="ghost" size="sm">
                        Quitar
                      </Button>
                    </form>
                  </div>
                </div>

                {group.ruleIds.map((ruleId, index) => (
                  <StandingReservations
                    key={ruleId}
                    organizationSlug={slug}
                    serviceId={serviceId}
                    scheduleRuleId={ruleId}
                    ruleLabel={`${WEEKDAY_SHORT[group.weekdays[index]!]} ${group.localStartTime.slice(0, 5)}`}
                    customers={customers}
                    reservations={standingByRule[ruleId] ?? []}
                    timezone={organization.timezone}
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
