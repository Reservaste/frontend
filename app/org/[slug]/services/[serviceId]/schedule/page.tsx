import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listResources } from "@/app/actions/resources";
import { listServices } from "@/app/actions/services";
import { discontinueScheduleRuleGroup, listScheduleRuleGroups } from "@/app/actions/schedule";
import { getCustomers } from "@/app/actions/admin";
import { listStandingReservations } from "@/app/actions/standing";
import { listOrganizationServicePlans } from "@/app/actions/service-plans";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { WEEKDAY_SHORT } from "@/lib/calendar";
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
  const { organization, membership } = await requireOrganizationMembership(slug);
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

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border bg-card px-4 py-3 text-sm shadow-card">
        <span className="text-muted-foreground">
          {coveringPlans.length === 0
            ? "Este servicio todavía no tiene planes."
            : `Este servicio tiene ${coveringPlans.length} ${coveringPlans.length === 1 ? "plan" : "planes"}: ${coveringPlans
                .map((plan) => plan.name)
                .join(", ")}.`}
        </span>
        <Link
          href={`/org/${slug}/plans?serviceId=${serviceId}`}
          className="shrink-0 text-primary underline-offset-4 hover:underline"
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

      <h2 className="text-sm font-semibold">Horarios</h2>

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
