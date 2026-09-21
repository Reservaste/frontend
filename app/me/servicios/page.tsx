import { getMyServices } from "@/app/actions/customer";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Mis servicios" };

const CYCLE_LABEL: Record<string, string> = {
  CALENDAR_MONTH: "por mes calendario",
  ROLLING_MONTH: "por mes desde el pago",
};

export default async function MyServicesPage() {
  const services = await getMyServices();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-xl">Mis servicios</h1>

      {services.length === 0 ? (
        <EmptyState
          title="Todavía no sos cliente de ningún negocio"
          description="Cuando un negocio te dé de alta, sus servicios aparecen acá."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {services.map((service) => (
            <li
              key={service.serviceId}
              className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 shadow-card"
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

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {service.price !== null ? (
                  <span className="tnum">
                    ${service.price.toLocaleString("es-UY")}
                    {service.billingType === "MONTHLY" ? " / mes" : ""}
                  </span>
                ) : null}
                {service.billingCycle ? <span>{CYCLE_LABEL[service.billingCycle]}</span> : null}
                {service.paymentRequired && service.coveredUntil ? (
                  <span className="tnum">
                    pago hasta {new Date(`${service.coveredUntil}T12:00:00Z`).toLocaleDateString("es-UY")}
                  </span>
                ) : null}
              </div>

              {service.paymentRequired && !service.isCoveredToday ? (
                <p className="text-xs text-muted-foreground">
                  Regularizá con el negocio para poder reservar.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
