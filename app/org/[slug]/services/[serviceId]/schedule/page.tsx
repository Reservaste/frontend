import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listResources } from "@/app/actions/resources";
import { listScheduleRules, listUpcomingOccurrences } from "@/app/actions/schedule";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScheduleRuleForm } from "./schedule-rule-form";

const WEEKDAY_NAMES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default async function ServiceSchedulePage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);
  const [resources, rules, occurrences] = await Promise.all([
    listResources(slug),
    listScheduleRules(slug, serviceId),
    listUpcomingOccurrences(slug, serviceId),
  ]);

  const resourceName = (resourceId: string) => resources.find((r) => r.id === resourceId)?.name ?? resourceId;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Horarios</h1>

      <ScheduleRuleForm organizationSlug={slug} serviceId={serviceId} resources={resources} />

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">Reglas activas</h2>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay horarios para este servicio.</p>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id}>
              <CardHeader>
                <CardTitle className="text-base">
                  {WEEKDAY_NAMES[rule.weekday]} {rule.localStartTime.slice(0, 5)} · {rule.durationMinutes} min
                </CardTitle>
                <CardDescription>
                  {resourceName(rule.resourceId)} · capacidad {rule.capacity}
                </CardDescription>
              </CardHeader>
            </Card>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Próximas ocurrencias ({organization.timezone})
        </h2>
        {occurrences.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin ocurrencias generadas todavía — se crean automáticamente al agregar un horario.
          </p>
        ) : (
          <div className="flex flex-col gap-1 text-sm">
            {occurrences.map((occ) => (
              <div key={occ.id} className="flex items-center justify-between rounded border px-3 py-2">
                <span>
                  {new Date(occ.startAt).toLocaleString("es-UY", {
                    timeZone: organization.timezone,
                    weekday: "short",
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="text-muted-foreground">
                  capacidad {occ.capacity} · {occ.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
