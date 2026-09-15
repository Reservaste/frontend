import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { availabilityLabel } from "./availability-label";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, availabilityTone } from "@/components/status";
import { EmptyState } from "@/components/empty-state";

export async function generateMetadata({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const organization = await getPublicOrganization(organizationSlug);
  return { title: organization?.name ?? "Negocio" };
}

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

  const initials = organization.name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-3 px-5 py-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary text-lg font-semibold text-primary-foreground">
            {initials}
          </span>
          <h1 className="text-2xl">{organization.name}</h1>
          <p className="text-sm text-muted-foreground">Elegí un servicio y reservá tu lugar</p>
          {services.length > 0 ? (
            <Link
              href={`/${organizationSlug}/reservar`}
              className={buttonVariants({ size: "lg", className: "mt-1" })}
            >
              Reservar un horario
            </Link>
          ) : null}
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-8">
        {services.length === 0 ? (
          <EmptyState
            title="Todavía no hay servicios publicados"
            description="Este negocio aún no cargó lo que ofrece. Volvé a intentar más tarde."
          />
        ) : (
          services.map((service, i) => {
            const slots: PublicAvailabilitySlot[] = availabilityByService[i]!.slice(0, 4);

            return (
              <section
                key={service.id}
                className="overflow-hidden rounded-xl border bg-card shadow-card"
              >
                <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="flex flex-col gap-0.5">
                    <h2 className="text-base">{service.name}</h2>
                    {service.description ? (
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    ) : null}
                  </div>
                  <Link
                    href={`/${organizationSlug}/reservar?service=${service.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Ver horarios
                  </Link>
                </div>

                {slots.length > 0 ? (
                  <ul className="divide-y border-t">
                    {slots.map((slot) => (
                      <li key={slot.slotOccurrenceId} className="flex items-center justify-between gap-3 px-5 py-3">
                        <span className="tnum text-sm">
                          {new Date(slot.startAt).toLocaleString("es-UY", {
                            timeZone: organization.timezone,
                            weekday: "short",
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                            hourCycle: "h23",
                          })}
                        </span>
                        <StatusBadge tone={availabilityTone(slot.status, slot.remaining)}>
                          {availabilityLabel(slot)}
                        </StatusBadge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="border-t px-5 py-3 text-sm text-muted-foreground">
                    Sin horarios próximos.
                  </p>
                )}
              </section>
            );
          })
        )}
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Horarios en {organization.timezone.replace("_", " ")} · con Reservaste
        </p>
      </footer>
    </div>
  );
}
