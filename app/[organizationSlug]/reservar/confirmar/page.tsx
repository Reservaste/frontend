import type { ReactNode } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { checkCanBookDetail, getSlotDetail } from "@/app/actions/customer";
import { getPublicOrganization } from "@/app/actions/public";
import { BOOKING_REASONS, bookingReasonTone } from "@/lib/booking-reasons";
import { availabilityLabel } from "../../availability-label";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge, availabilityTone } from "@/components/status";
import { BackLink } from "@/components/back-link";
import { BrandTheme } from "@/components/brand-theme";
import { buttonVariants } from "@/components/ui/button";
import { Alert, type AlertTone } from "@/components/ui/alert";
import { AlertCircleIcon, AlertTriangleIcon, InfoIcon } from "@/components/icons";
import { ConfirmForm } from "./confirm-form";

/**
 * `bookingReasonTone` says *which* bucket a reason falls in; this is the
 * mapping to how `Alert` renders it. Kept next to the one call site instead
 * of inside `lib/booking-reasons.ts` because that module is shared with
 * server actions that don't render anything.
 */
const REASON_ALERT: Record<
  ReturnType<typeof bookingReasonTone>,
  { tone: AlertTone; icon: ReactNode }
> = {
  neutral: { tone: "info", icon: <InfoIcon /> },
  customer: { tone: "warning", icon: <AlertTriangleIcon /> },
  owner: { tone: "danger", icon: <AlertCircleIcon /> },
};

/**
 * `expires_on` es una `date` congelada al emitir (ADR-0025), no un
 * instante: se formatea a mediodía UTC para que no se corra un día al
 * leerla desde cualquier huso.
 */
function creditExpiryLabel(expiresOn: string): string {
  return new Date(`${expiresOn}T12:00:00Z`).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
  });
}

export const metadata = { title: "Confirmar reserva" };

/**
 * ADR-0015, the post-login step. Three things happen here and the order
 * matters:
 *
 *  1. If nobody is signed in, bounce to login carrying this exact URL as
 *     returnTo -- the booking intent lives in the URL, unsigned, because
 *     it is public data and gets re-validated below regardless.
 *  2. Re-render *what is about to be booked* and re-run the eligibility
 *     check, so a slot that filled up during login says so here rather
 *     than failing after a click.
 *  3. Never book automatically. The person confirms explicitly -- that's
 *     what stops a link someone was sent from silently consuming their
 *     credit.
 */
export default async function ConfirmarPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { organizationSlug } = await params;
  const { slot } = await searchParams;

  if (!slot) {
    redirect(`/${organizationSlug}/reservar`);
  }

  const detail = await getSlotDetail(slot);
  if (!detail || detail.organizationSlug !== organizationSlug) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const returnTo = `/${organizationSlug}/reservar/confirmar?slot=${slot}`;
    redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }

  // Fase 25: la versión `_detail` del mismo chequeo. No es una regla nueva
  // ni una segunda opinión -- es la misma RPC devolviendo, además del
  // motivo, con qué entra la reserva. ADR-0025 nunca gasta un crédito si
  // otra cobertura alcanzaba, así que un `OK` que además trae crédito
  // significa "esto lo habilita tu crédito", y eso hay que decirlo antes
  // del botón: hasta acá se gastaba en silencio.
  const { reason: canBook, makeupCreditExpiresOn } = await checkCanBookDetail(slot);
  // public_slot_detail() carries the slot, not the business's branding --
  // this page still has to look like the page the visitor came from.
  const organization = await getPublicOrganization(organizationSlug);

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: detail.organizationTimezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const timeFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: detail.organizationTimezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const start = new Date(detail.startAt);
  const end = new Date(detail.endAt);

  return (
    <BrandTheme
      color={organization?.brandColor ?? null}
      className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-5 py-8"
    >
      <BackLink href={`/${organizationSlug}`}>
        Elegir otro horario
      </BackLink>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-raised">
        <div className="flex flex-col items-center gap-1 border-b bg-primary-subtle px-6 py-6 text-center">
          <span className="eyebrow text-primary-on-subtle">{detail.organizationName}</span>
          <h1 className="text-xl">{detail.serviceName}</h1>
        </div>

        <div className="flex flex-col gap-5 px-6 py-6">
          <div className="flex flex-col items-center gap-1 text-center">
            <p className="text-sm capitalize text-muted-foreground">{dateFormatter.format(start)}</p>
            <p className="tnum text-3xl font-semibold">
              {timeFormatter.format(start)}
              <span className="text-lg font-normal text-muted-foreground"> – {timeFormatter.format(end)}</span>
            </p>
            <StatusBadge tone={availabilityTone(detail.status, detail.remaining)} className="mt-1">
              {availabilityLabel({
                ...detail,
                serviceName: detail.serviceName,
                serviceColor: null,
                // Esta pantalla es la confirmación de un turno ya elegido, no
                // la agenda: el badge de "cupo liberado" (ADR-0025) no aplica
                // acá, es una señal de la lista, no de la confirmación.
                recentlyReleased: null,
              })}
            </StatusBadge>
          </div>

          {canBook === "OK" ? (
            <div className="flex flex-col gap-3">
              {/* Sólo cuando el crédito es lo que habilita la reserva: un
                  OK común no trae ninguno, así que esto no aparece en el
                  camino normal. */}
              {makeupCreditExpiresOn ? (
                <Alert tone="info" icon={<InfoIcon />} size="sm">
                  Esta reserva usa tu crédito de recupero, que vence el{" "}
                  <span className="tnum font-medium">{creditExpiryLabel(makeupCreditExpiresOn)}</span>.
                </Alert>
              ) : null}
              <ConfirmForm slotOccurrenceId={slot} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Alert {...REASON_ALERT[bookingReasonTone(canBook)]}>
                {BOOKING_REASONS[canBook] ?? "No podés reservar este horario"}
              </Alert>
              {/* Pedido del cliente: los dos motivos de cuota no se
                  resuelven pagando otra vez ni eligiendo otro horario, se
                  resuelven cambiando de plan. El texto ya lo dice; esto es
                  la puerta para hacerlo.
                  Iba a `/me/servicios`, que muestra el plan que la persona
                  **ya** tiene -- justamente el que no le alcanza. Desde
                  Fase 28 hay catálogo público (ADR-0035), acotado al
                  servicio de este slot: quien se choca con la cuota está
                  parado frente a un servicio concreto, no frente a la
                  lista de precios entera. */}
              {canBook === "OVER_PLAN_QUOTA" || canBook === "OUTSIDE_PLAN_QUOTA" ? (
                <Link
                  href={`/${organizationSlug}/planes?servicio=${encodeURIComponent(detail.serviceId)}`}
                  className={buttonVariants({ variant: "outline", size: "touch", className: "w-full" })}
                >
                  Ver planes de {detail.serviceName}
                </Link>
              ) : null}
              <Link
                href={`/${organizationSlug}`}
                className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Ver otros horarios
              </Link>
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Horario en {detail.organizationTimezone.replace("_", " ")}
      </p>
    </BrandTheme>
  );
}
