import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listResources } from "@/app/actions/resources";
import { listServices } from "@/app/actions/services";
import { listScheduleRules, listUpcomingOccurrences } from "@/app/actions/schedule";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";
import { ScheduleRuleForm } from "./schedule-rule-form";

export const metadata = { title: "Horarios" };

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function ServiceSchedulePage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);
  const [resources, services, rules, occurrences] = await Promise.all([
    listResources(slug),
    listServices(slug),
    listScheduleRules(slug, serviceId),
    listUpcomingOccurrences(slug, serviceId),
  ]);

  const service = services.find((s) => s.id === serviceId);
  const resourceName = (resourceId: string) => resources.find((r) => r.id === resourceId)?.name ?? "—";

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <Link
        href={`/org/${slug}/services`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg viewBox="0 0 24 24" fill="none" className="size-4">
          <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Servicios
      </Link>

      <PageHeader
        title={service?.name ?? "Horarios"}
        description="Cada regla genera turnos automáticamente para los próximos 90 días"
      />

      <ScheduleRuleForm organizationSlug={slug} serviceId={serviceId} resources={resources} />

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Horarios semanales</h2>
        {rules.length === 0 ? (
          <EmptyState
            title="Sin horarios cargados"
            description="Agregá un horario semanal y los turnos aparecen solos en la agenda."
          />
        ) : (
          <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
            {rules.map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                <div className="flex flex-col">
                  <span className="font-medium">
                    {WEEKDAY_NAMES[rule.weekday]}{" "}
                    <span className="tnum">{rule.localStartTime.slice(0, 5)}</span>
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {resourceName(rule.resourceId)} · {rule.durationMinutes} min
                  </span>
                </div>
                <StatusBadge tone="primary">{rule.capacity} lugares</StatusBadge>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Próximos turnos generados</h2>
          <span className="text-xs text-muted-foreground">{organization.timezone}</span>
        </div>
        {occurrences.length === 0 ? (
          <p className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            Se generan automáticamente al crear un horario.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {occurrences.map((occ) => (
              <li
                key={occ.id}
                className="flex items-center justify-between gap-2 rounded-xl border bg-card px-3.5 py-2.5 shadow-card"
              >
                <span className="tnum text-sm capitalize">{dateFormatter.format(new Date(occ.startAt))}</span>
                <span className="tnum text-xs text-muted-foreground">{occ.capacity} lugares</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
