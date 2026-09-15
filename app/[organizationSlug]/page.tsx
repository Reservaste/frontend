import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { availabilityLabel } from "./availability-label";

export default async function PublicOrganizationPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const organization = await getPublicOrganization(organizationSlug);

  if (!organization) {
    notFound();
  }

  const services = await listPublicServices(organization.id);
  const availabilityByService = await Promise.all(
    services.map((service) => getPublicAvailability(organizationSlug, service.id)),
  );

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{organization.name}</h1>
      </div>

      {services.length === 0 ? (
        <p className="text-sm text-muted-foreground">Este negocio todavía no publicó servicios.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {services.map((service, i) => {
            const slots: PublicAvailabilitySlot[] = availabilityByService[i]!.slice(0, 5);
            return (
              <Card key={service.id}>
                <CardHeader>
                  <CardTitle>{service.name}</CardTitle>
                  {service.description ? <CardDescription>{service.description}</CardDescription> : null}
                </CardHeader>
                <div className="flex flex-col gap-1 px-6 pb-6 text-sm">
                  {slots.length === 0 ? (
                    <p className="text-muted-foreground">Sin horarios próximos.</p>
                  ) : (
                    slots.map((slot) => (
                      <div key={slot.slotOccurrenceId} className="flex items-center justify-between">
                        <span>
                          {new Date(slot.startAt).toLocaleString("es-UY", {
                            timeZone: organization.timezone,
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span className="text-muted-foreground">{availabilityLabel(slot)}</span>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {services.length > 0 ? (
        <Link href={`/${organizationSlug}/reservar`} className={buttonVariants({ variant: "default" })}>
          Reservar un horario
        </Link>
      ) : null}
    </div>
  );
}
