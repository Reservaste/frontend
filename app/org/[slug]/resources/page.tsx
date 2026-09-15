import { listResources } from "@/app/actions/resources";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ResourceForm } from "./resource-form";
import { ResourceRow } from "./resource-row";

export const metadata = { title: "Recursos" };

export default async function ResourcesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const resources = await listResources(slug);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Recursos"
        description="Lo que se ocupa al dar el servicio: salas, profesionales, canchas, equipos"
      />

      <ResourceForm organizationSlug={slug} />

      {resources.length === 0 ? (
        <EmptyState
          title="Todavía no hay recursos"
          description="Cada horario ocupa un recurso, así que necesitás al menos uno para armar la agenda."
        />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {resources.map((resource) => (
            <ResourceRow key={resource.id} organizationSlug={slug} resource={resource} />
          ))}
        </ul>
      )}
    </div>
  );
}
