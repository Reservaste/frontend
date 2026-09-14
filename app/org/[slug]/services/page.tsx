import Link from "next/link";
import { listServices } from "@/app/actions/services";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ServiceForm } from "./service-form";

export default async function ServicesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const services = await listServices(slug);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">Servicios</h1>

      <ServiceForm organizationSlug={slug} />

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay servicios.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {services.map((service) => (
            <Link key={service.id} href={`/org/${slug}/services/${service.id}/schedule`}>
              <Card className="transition-colors hover:bg-muted">
                <CardHeader>
                  <CardTitle className="text-base">{service.name}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
