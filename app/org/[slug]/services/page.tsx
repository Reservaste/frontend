import Link from "next/link";
import { listServices } from "@/app/actions/services";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { ServiceForm } from "./service-form";

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
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {services.map((service) => (
            <li key={service.id}>
              <Link
                href={`/org/${slug}/services/${service.id}/schedule`}
                className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium">{service.name}</span>
                  {service.description ? (
                    <span className="truncate text-sm text-muted-foreground">{service.description}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Configurar horarios</span>
                  )}
                </div>
                <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-muted-foreground">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
