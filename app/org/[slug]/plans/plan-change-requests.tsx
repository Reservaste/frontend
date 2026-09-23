import Link from "next/link";
import {
  resolvePlanChangeRequest,
  type PlanChangeRequest,
} from "@/app/actions/plan-changes";
import { Button, buttonVariants } from "@/components/ui/button";
import { DataList, DataListRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status";
import { formatMoney } from "@/lib/money";
import { planSummary } from "@/lib/plan-labels";

/**
 * Lo que el mostrador tiene para atender (ADR-0035).
 *
 * Vive en la lista de precios y no en pagos porque un pedido es una
 * pregunta sobre el catálogo ("¿me pasás a este plan?"), y porque cobrarlo
 * lo cierra solo: registrar el pago del plan pedido dispara el trigger y
 * el pedido desaparece de acá sin que nadie toque un botón. Los dos
 * botones son para la venta que no pasó por la pantalla de pagos —
 * deliberadamente chicos: no mueven dinero ni cobertura.
 *
 * Server component: `resolvePlanChangeRequest` devuelve void y es el
 * target directo de `<form action>`, sin estado de cliente en el medio.
 */
export function PlanChangeRequests({
  organizationSlug,
  requests,
  timezone,
}: {
  organizationSlug: string;
  requests: PlanChangeRequest[];
  timezone: string;
}) {
  if (requests.length === 0) return null;

  const dateFormatter = new Intl.DateTimeFormat("es-UY", {
    timeZone: timezone,
    day: "2-digit",
    month: "2-digit",
  });

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Pedidos de cambio de plan{" "}
          <span className="tnum font-normal text-muted-foreground">({requests.length})</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Cobrar el plan pedido lo cierra solo.
        </p>
      </div>

      <DataList>
        {requests.map((request) => (
          <DataListRow key={request.requestId} className="flex flex-col gap-2 px-4 py-3.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="font-medium">{request.customerName}</span>
                <span className="text-xs text-muted-foreground">
                  Pide <span className="font-medium text-foreground">{request.requestedPlanName}</span>{" "}
                  <span className="tnum">
                    {formatMoney(request.requestedPlanPrice, request.currency)}
                  </span>{" "}
                  · {planSummary(request.requestedPlanKind, request.requestedWeeklyQuota)}
                </span>
                <span className="text-xs text-muted-foreground">
                  Hoy: {request.currentPlanName ?? "sin plan vigente"}
                  {request.currentPlanPrice !== null ? (
                    <>
                      {" "}
                      <span className="tnum">
                        {formatMoney(request.currentPlanPrice, request.currency)}
                      </span>
                    </>
                  ) : null}
                </span>
              </div>
              <StatusBadge tone="warning">
                <span className="tnum">{dateFormatter.format(new Date(request.createdAt))}</span>
              </StatusBadge>
            </div>

            {request.note ? (
              <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                “{request.note}”
              </p>
            ) : null}

            <div className="flex flex-wrap items-center gap-2">
              {/* El camino real: cobrar. Los dos botones de al lado son la
                  salida para cuando la venta no pasó por acá. */}
              <Link
                href={`/org/${organizationSlug}/payments/${request.customerId}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Registrar el pago
              </Link>
              <form
                action={resolvePlanChangeRequest.bind(
                  null,
                  organizationSlug,
                  request.requestId,
                  "APPLIED",
                )}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Ya lo atendí
                </Button>
              </form>
              <form
                action={resolvePlanChangeRequest.bind(
                  null,
                  organizationSlug,
                  request.requestId,
                  "DISMISSED",
                )}
              >
                <Button type="submit" variant="ghost" size="sm">
                  Descartar
                </Button>
              </form>
            </div>
          </DataListRow>
        ))}
      </DataList>
    </section>
  );
}
