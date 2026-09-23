import { getMyServices } from "@/app/actions/customer";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { PageHeader } from "@/components/page-header";
import { DataList, DataListRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/money";
import { PLAN_KIND_LABEL } from "@/lib/plan-labels";

export const metadata = { title: "Mis servicios" };

export default async function MyServicesPage() {
  const services = await getMyServices();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <PageHeader title="Mis servicios" />

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
                  <span className="text-xs text-muted-foreground">{service.organizationName}</span>
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
            </DataListRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
