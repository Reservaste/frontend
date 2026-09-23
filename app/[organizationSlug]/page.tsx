import Link from "next/link";
import { notFound } from "next/navigation";
import type { PublicAvailabilitySlot } from "@reservaste/domain";
import { getPublicAvailability, getPublicOrganization, listPublicServices } from "@/app/actions/public";
import { getMyOrganizations } from "@/app/actions/organizations";
import { availabilityLabel } from "./availability-label";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { BrandTheme } from "@/components/brand-theme";
import { OrganizationLogo } from "@/components/organization-logo";
import { PublicCalendar, type PublicSlot } from "@/components/calendar/public-calendar";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert } from "@/components/ui/alert";
import { CheckIcon } from "@/components/icons";

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
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ activado?: string }>;
}) {
  const { organizationSlug } = await params;
  const { activado } = await searchParams;
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

  // Not an authorization check (requireOrganizationMembership + RLS remain
  // the real gate on /org/[slug]) -- this only decides whether to surface a
  // shortcut for someone who's looking at their own org's public page.
  const isStaffOfThisOrg = user
    ? (await getMyOrganizations()).some((m) => m.organization.id === organization.id)
    : false;

  return (
    <BrandTheme color={organization.brandColor} className="flex flex-1 flex-col">
      {/* brand-wash: the one place per page where the organization's own
          accent (ADR-0020) gets to be a colour field, not just a button --
          otherwise every unbranded surface and every branded one look the
          same except for the "Reservar" button. */}
      <header className="brand-wash border-b border-border/70 bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-5 py-3">
          <Brand href={user ? "/dashboard" : "/"} />
          <div className="flex items-center gap-1">
            {/* Owner/staff looking at their own org's public page (same as
                a customer would see it) gets a shortcut back to the panel
                -- flex-wrap on the row above keeps this from overflowing
                next to Brand + "Mis reservas" on a narrow phone. */}
            {isStaffOfThisOrg ? (
              <Link
                href={`/org/${organizationSlug}`}
                className={buttonVariants({ variant: "outline", size: "touch" })}
              >
                Ir al panel
              </Link>
            ) : null}
            <Link
              href={user ? "/me" : `/login?returnTo=${encodeURIComponent(`/${organizationSlug}`)}`}
              className={buttonVariants({ variant: "ghost", size: "touch" })}
            >
              {user ? "Mis reservas" : "Ingresar"}
            </Link>
          </div>
        </div>

        {/* Compact on purpose: the identity has to be recognisable, but
            the calendar is what the page is for and it should be visible
            without scrolling on a phone. */}
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 border-t border-border/70 px-5 py-4">
          <OrganizationLogo name={organization.name} logoPath={organization.logoPath} size="md" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-lg">{organization.name}</h1>
            <p className="text-xs text-muted-foreground">Elegí un horario y reservá tu lugar</p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-5">
        {/* Lands here straight from WhatsApp activation (ADR-0026): the
            only confirmation that the flow actually worked, since this
            page never says "you're a customer" anywhere else. Read from
            the query string only -- no sessionStorage -- so it shows up
            exactly once, on this landing, and never again on the next
            navigation. */}
        {activado === "1" ? (
          <Alert tone="success" icon={<CheckIcon />}>
            Listo, ya podés reservar en {organization.name}.
          </Alert>
        ) : null}

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
