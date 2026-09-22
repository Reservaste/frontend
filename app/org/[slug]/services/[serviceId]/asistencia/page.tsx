import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getServiceAttendanceHistory } from "@/app/actions/admin";
import { listServices } from "@/app/actions/services";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/empty-state";
import { DataList, DataListRow } from "@/components/ui/table";
import { ServiceTabs } from "../service-tabs";

export const metadata = { title: "Asistencia" };

export default async function ServiceAttendancePage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);
  const [history, services] = await Promise.all([
    getServiceAttendanceHistory(slug, serviceId),
    listServices(slug),
  ]);

  const service = services.find((s) => s.id === serviceId);
  const when = (iso: string) =>
    new Intl.DateTimeFormat("es-UY", {
      timeZone: organization.timezone,
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Servicios", href: `/org/${slug}/services` },
          { label: service?.name ?? "Servicio" },
        ]}
      />
      <PageHeader title={service?.name ?? "Asistencia"} description="Clases que ya ocurrieron" />
      <ServiceTabs organizationSlug={slug} serviceId={serviceId} />

      {history.length === 0 ? (
        <EmptyState
          title="Todavía no hay clases dictadas"
          description="Cuando pasen las primeras clases vas a ver acá quién asistió."
        />
      ) : (
        <DataList>
          {history.map((entry) => (
            <DataListRow key={entry.slotOccurrenceId}>
              <Link
                href={`/org/${slug}/agenda/${entry.slotOccurrenceId}/asistencia`}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
              >
                <span className="tnum text-sm font-medium">{when(entry.startAt)}</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <span className="tnum text-muted-foreground">{entry.reserved} reservas</span>
                  <span className="tnum text-success">{entry.present} presentes</span>
                  <span className="tnum text-destructive">{entry.absent} ausentes</span>
                  {/* Pending is shown rather than folded into absent:
                      "nobody took the roll" is not the same as "they did
                      not come" (ADR-0022). */}
                  {entry.pending > 0 ? (
                    <span className="tnum text-muted-foreground">{entry.pending} sin marcar</span>
                  ) : null}
                </div>
              </Link>
            </DataListRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
