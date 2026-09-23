import Link from "next/link";
import { getMyServices } from "@/app/actions/customer";
import { getMyPlanChangeRequests } from "@/app/actions/plan-changes";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/page-header";
import { DataList, DataListRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { InfoIcon } from "@/components/icons";
import { formatMoney } from "@/lib/money";
import { PLAN_KIND_LABEL } from "@/lib/plan-labels";

export const metadata = { title: "Mis servicios" };

export default async function MyServicesPage() {
  const [services, planChangeRequests] = await Promise.all([
    getMyServices(),
    getMyPlanChangeRequests(),
  ]);

  // ADR-0035: un pedido pendiente no habilita ni bloquea nada, pero sin
  // mostrarlo el botón del catálogo es un agujero negro -- y la persona
  // vuelve a pedir lo mismo creyendo que no se envió.
  const pending = planChangeRequests.filter((request) => request.resolution === null);
  const organizationsWithPending = new Set(pending.map((request) => request.organizationSlug));

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <PageHeader title="Mis servicios" />

      {pending.length > 0 ? (
        <Alert tone="info" icon={<InfoIcon />} title="Pediste cambiar de plan">
          {pending.map((request) => (
            <p key={request.requestId}>
              <span className="font-medium">{request.planName}</span> en {request.organizationName}.
              El negocio te va a contactar para confirmarlo y cobrarlo — tu plan actual sigue
              vigente hasta entonces.
            </p>
          ))}
        </Alert>
      ) : null}

      {services.length === 0 ? (
        <EmptyState
          title="Todavía no sos cliente de ningún negocio"
          description="Cuando un negocio te dé de alta, sus servicios aparecen acá."
        />
      ) : (
        <DataList>
          {services.map((service) => (
            <DataListRow
              key={service.serviceId}
              className="flex flex-col gap-2 px-4 py-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{service.serviceName}</span>
                  {/* The business name used to be plain text here -- a dead
                      end for someone who came to this list precisely
                      because they didn't know where to go reserve
                      (feedback de producción "no veo la agenda para
                      reservar"). Its public page is the agenda (ADR-0023). */}
                  <Link
                    href={`/${service.organizationSlug}`}
                    className="text-xs text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                  >
                    {service.organizationName}
                  </Link>
                </div>

                {/* Nobody enables a service for a person any more
                    (ADR-0022): the only thing left to report is whether
                    the month is paid. */}
                {!service.paymentRequired ? (
                  <StatusBadge tone="success">Podés reservar</StatusBadge>
                ) : service.isCoveredToday ? (
                  <StatusBadge tone="success">Al día</StatusBadge>
                ) : (
                  <StatusBadge tone="danger">Falta el pago</StatusBadge>
                )}
              </div>

              {/* The plan that actually covers them today (ADR-0029) --
                  never a service-level price, which stopped meaning
                  anything the day a service could sell more than one
                  plan (ADR-0024). No plan resolved is a fact worth
                  showing on its own: "sin plan" is not the same silence
                  as a free service. */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {service.planName ? (
                  <>
                    <span className="font-medium text-foreground">{service.planName}</span>
                    {service.planPrice !== null ? (
                      <span className="tnum">{formatMoney(service.planPrice, service.currency)}</span>
                    ) : null}
                    {service.planKind ? <span>{PLAN_KIND_LABEL[service.planKind]}</span> : null}
                    {service.coveredUntil ? (
                      <span className="tnum">
                        cubre hasta{" "}
                        {new Date(`${service.coveredUntil}T12:00:00Z`).toLocaleDateString("es-UY")}
                      </span>
                    ) : null}
                  </>
                ) : service.paymentRequired ? (
                  <span>Sin plan vigente</span>
                ) : null}
              </div>

              {service.paymentRequired && !service.isCoveredToday ? (
                <p className="text-xs text-muted-foreground">
                  Para volver a reservar, regularizá tu pago directamente con el negocio -- esto no
                  se resuelve desde la app.
                </p>
              ) : null}

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${service.organizationSlug}`}
                  className={buttonVariants({ variant: "outline", size: "touch" })}
                >
                  Ver agenda
                </Link>
                {/* La única puerta del cliente al catálogo (ADR-0035):
                    acotada a este servicio, que es lo que está mirando.
                    Si ya pidió un cambio en este negocio, el botón lo
                    dice en vez de invitar a pedir de nuevo. */}
                <Link
                  href={`/${service.organizationSlug}/planes?servicio=${encodeURIComponent(service.serviceId)}`}
                  className={buttonVariants({ variant: "ghost", size: "touch" })}
                >
                  {organizationsWithPending.has(service.organizationSlug)
                    ? "Ver planes (pedido enviado)"
                    : service.planName
                      ? "Cambiar de plan"
                      : "Ver planes"}
                </Link>
              </div>
            </DataListRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
