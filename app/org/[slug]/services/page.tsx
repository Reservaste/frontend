import { listServices } from "@/app/actions/services";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { DataList } from "@/components/ui/table";
import { ServiceForm } from "./service-form";
import { ServiceRow } from "./service-row";

export const metadata = { title: "Servicios" };

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const services = await listServices(slug);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader title="Servicios" description="Lo que tu negocio ofrece y se puede reservar" />

      <ServiceForm organizationSlug={slug} />

      {services.length === 0 ? (
        <EmptyState
          title="Todavía no hay servicios"
          description="Un servicio es lo que la gente reserva: una clase, un turno, una cancha."
        />
      ) : (
        <DataList>
          {services.map((service) => (
            <ServiceRow key={service.id} organizationSlug={slug} service={service} />
          ))}
        </DataList>
      )}
    </div>
  );
}
