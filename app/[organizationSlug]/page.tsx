import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { availabilityLabel } from "./availability-label";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { BrandTheme } from "@/components/brand-theme";
import { OrganizationLogo } from "@/components/organization-logo";
import { PublicCalendar, type PublicSlot } from "@/components/calendar/public-calendar";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

export async function generateMetadata({ params }: { params: Promise<{ organizationSlug: string }> }) {
  const { organizationSlug } = await params;
  const organization = await getPublicOrganization(organizationSlug);
  return { title: organization?.name ?? "Negocio" };
}

/**
 * The business's public page IS its agenda (ADR-0023).
 *
 * It used to be a list of service cards with a handful of slots each and
 * a "Reservar un horario" button that led to the actual calendar. That
 * put the thing everyone came for one tap away from where they landed,
 * and made the same information exist twice in two shapes.
 */
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

  // Four weeks: enough to browse forward without a round trip per arrow,
  // and well inside the 90-day rolling window (ADR-0009).
  const now = new Date();
  const raw = await getPublicAvailability(
    organizationSlug,
    undefined,
    now,
    new Date(now.getTime() + 28 * 86_400_000),
  );

  const slots: PublicSlot[] = raw.map((slot: PublicAvailabilitySlot) => ({
    slotOccurrenceId: slot.slotOccurrenceId,
    serviceId: slot.serviceId,
    serviceName: slot.serviceName,
    serviceColor: slot.serviceColor,
    startAt: slot.startAt,
    endAt: slot.endAt,
    // Already respects the disclosure mode of ADR-0008.
    availability: availabilityLabel(slot),
    full: slot.status === "FULL" || slot.remaining === 0,
    // ADR-0025: boolean-only, already suppressed by the database in
    // BOOLEAN mode and at capacity 1 -- this page just renders it.
    recentlyReleased: Boolean((slot as { recentlyReleased?: boolean | null }).recentlyReleased),
  }));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <BrandTheme color={organization.brandColor} className="flex flex-1 flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-5 py-3">
          <Brand href={user ? "/dashboard" : "/"} />
          <Link
            href={user ? "/me" : `/login?returnTo=${encodeURIComponent(`/${organizationSlug}`)}`}
            className={buttonVariants({ variant: "ghost", size: "touch" })}
          >
            {user ? "Mis reservas" : "Ingresar"}
          </Link>
        </div>

        {/* Compact on purpose: the identity has to be recognisable, but
            the calendar is what the page is for and it should be visible
            without scrolling on a phone. */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 border-t px-5 py-4">
          <OrganizationLogo name={organization.name} logoPath={organization.logoPath} size="md" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-lg">{organization.name}</h1>
            <p className="text-xs text-muted-foreground">Elegí un horario y reservá tu lugar</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-5">
        {services.length === 0 ? (
          <EmptyState
            title="Todavía no hay servicios publicados"
            description="Este negocio aún no cargó lo que ofrece. Volvé a intentar más tarde."
          />
        ) : (
          <PublicCalendar
            organizationSlug={organizationSlug}
            slots={slots}
            timeZone={organization.timezone}
          />
        )}
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Horarios en {organization.timezone.replace("_", " ")} · con Reservaste
        </p>
      </footer>
    </BrandTheme>
  );
}
