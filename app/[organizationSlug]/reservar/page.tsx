import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { availabilityLabel } from "../availability-label";
import { EmptyState } from "@/components/empty-state";
import { ChevronLeft } from "@/components/icons";
import { BrandTheme } from "@/components/brand-theme";
import { OrganizationLogo } from "@/components/organization-logo";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { PublicCalendar, type PublicSlot } from "@/components/calendar/public-calendar";

export const metadata = { title: "Reservar" };

// Mobile-first (ADR-0023): this is opened on a phone, standing in the
// gym. A day strip plus a list, not seven columns of an hour grid.

export default async function ReservarPage({
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
  if (services.length === 0) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-8">
        <EmptyState
          title="Sin servicios publicados"
          description={`${organization.name} todavía no publicó servicios para reservar.`}
        />
      </div>
    );
  }

  // Four weeks ahead: enough to browse forward without a round trip on
  // every arrow press, and well inside the 90-day rolling window.
  const now = new Date();
  const raw = await getPublicAvailability(
    organizationSlug,
    undefined,
    now,
    new Date(now.getTime() + 28 * 86400000),
  );

  const slots: PublicSlot[] = raw.map((slot: PublicAvailabilitySlot) => ({
    slotOccurrenceId: slot.slotOccurrenceId,
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    serviceColor: slot.serviceColor,
    startAt: slot.startAt,
    endAt: slot.endAt,
    // Already respects the disclosure mode of ADR-0008: EXACT shows the
    // number, the others do not.
    availability: availabilityLabel(slot),
    full: slot.status === "FULL" || slot.remaining === 0,
  }));

  return (
    <BrandTheme color={organization.brandColor} className="flex flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-3">
          <Link
            href={`/${organizationSlug}`}
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Volver a ${organization.name}`}
            title={`Volver a ${organization.name}`}
          >
            <ChevronLeft />
          </Link>
          <OrganizationLogo name={organization.name} logoPath={organization.logoPath} size="sm" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{organization.name}</span>
            <span className="text-xs text-muted-foreground">Elegí tu horario</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-5">
        <PublicCalendar
          organizationSlug={organizationSlug}
          slots={slots}
          timeZone={organization.timezone}
        />
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Horarios en {organization.timezone.replace("_", " ")} · con Reservaste
        </p>
      </footer>
    </BrandTheme>
  );
}
