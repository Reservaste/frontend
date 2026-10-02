import { notFound, redirect } from "next/navigation";
import { getPublicOrganization, getPublicService } from "@/app/actions/public";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { BrandTheme } from "@/components/brand-theme";
import { ConfirmDynamicForm } from "./confirm-dynamic-form";

export const metadata = { title: "Confirmar reserva" };

/**
 * ADR-0051, el paso de hold + confirmar. A diferencia de
 * `reservar/confirmar/page.tsx` (ADR-0015, donde elegir es sólo lectura
 * sobre una fila que ya existe y el login se resuelve recién acá), este
 * flujo necesita sesión un paso antes: `hold_dynamic_slot()` exige
 * `auth.uid()` porque es un insert real sobre un recurso escaso. Esta
 * página resuelve esa sesión; el hold en sí lo dispara el cliente.
 */
export default async function ConfirmarDinamicoPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string; serviceId: string }>;
  searchParams: Promise<{ resource?: string; start?: string }>;
}) {
  const { organizationSlug, serviceId } = await params;
  const { resource, start } = await searchParams;

  if (!resource || !start) {
    redirect(`/${organizationSlug}/reservar-dinamico/${serviceId}`);
  }

  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    notFound();
  }

  const organization = await getPublicOrganization(organizationSlug);
  if (!organization) {
    notFound();
  }

  const service = await getPublicService(organization.id, serviceId);
  if (!service || !service.hasDynamicResource) {
    notFound();
  }

  const currentUrl = `/${organizationSlug}/reservar-dinamico/${serviceId}/confirmar?resource=${encodeURIComponent(
    resource,
  )}&start=${encodeURIComponent(start)}`;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(currentUrl)}`);
  }

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return (
    <BrandTheme
      color={organization.brandColor}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-8"
    >
      <BackLink href={`/${organizationSlug}/reservar-dinamico/${serviceId}`}>Elegir otro horario</BackLink>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-raised">
        <div className="flex flex-col items-center gap-1 border-b bg-primary-subtle px-6 py-6 text-center">
          <span className="eyebrow text-primary-on-subtle">{organization.name}</span>
          <h1 className="text-xl">{service.name}</h1>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm capitalize text-muted-foreground">{dateFormatter.format(startDate)}</p>
            <p className="tnum text-3xl font-semibold">{timeFormatter.format(startDate)}</p>
          </div>

          <ConfirmDynamicForm
            organizationSlug={organizationSlug}
            serviceId={serviceId}
            resourceId={resource}
            startAtIso={start}
            returnTo={currentUrl}
          />
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Horario en {organization.timezone.replace("_", " ")}
      </p>
    </BrandTheme>
  );
}
