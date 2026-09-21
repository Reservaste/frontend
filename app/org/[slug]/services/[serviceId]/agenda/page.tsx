import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda } from "@/app/actions/admin";
import { listServices } from "@/app/actions/services";
import { PageHeader } from "@/components/page-header";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AgendaCalendar } from "@/components/calendar/agenda-calendar";
import { ServiceTabs } from "../service-tabs";

export const metadata = { title: "Agenda del servicio" };

export default async function ServiceAgendaPage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const now = new Date();
  const [occurrences, services] = await Promise.all([
    getAgenda(slug, new Date(now.getTime() - 30 * 86400000), new Date(now.getTime() + 95 * 86400000)),
    listServices(slug),
  ]);

  const service = services.find((s) => s.id === serviceId);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Servicios", href: `/org/${slug}/services` },
          { label: service?.name ?? "Servicio" },
        ]}
      />
      <PageHeader title={service?.name ?? "Agenda"} description="Solo los turnos de este servicio" />
      <ServiceTabs organizationSlug={slug} serviceId={serviceId} />

      {/* The same calendar the organization-wide agenda uses, with the
          service fixed: one component, not two that drift apart. */}
      <AgendaCalendar
        organizationSlug={slug}
        occurrences={occurrences}
        services={services.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        timeZone={organization.timezone}
        lockedServiceId={serviceId}
      />
    </div>
  );
}
