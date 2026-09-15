import { getMyEntitlements } from "@/app/actions/customer";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Mis servicios" };

export default async function MyServicesPage() {
  const entitlements = await getMyEntitlements();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-xl">Mis servicios</h1>

      {entitlements.length === 0 ? (
        <EmptyState
          title="Sin servicios habilitados"
          description="El negocio te habilita los servicios desde su panel. Consultá con ellos."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {entitlements.map((e) => {
            // "Active but unpaid" is the state worth calling out -- it's
            // the difference between having the service and being able to
            // book it today.
            const blocked = e.isActive && e.requiresActivePayment && !e.paidToday;

            return (
              <li key={e.entitlementId} className="flex flex-col gap-2 rounded-xl border bg-card px-4 py-3.5 shadow-card">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{e.serviceName}</span>
                  {!e.isActive ? (
                    <StatusBadge tone="neutral">Revocado</StatusBadge>
                  ) : blocked ? (
                    <StatusBadge tone="warning">Pago pendiente</StatusBadge>
                  ) : (
                    <StatusBadge tone="success">Podés reservar</StatusBadge>
                  )}
                </div>

                <span className="text-xs text-muted-foreground">{e.organizationName}</span>

                <span className="text-sm text-muted-foreground">
                  {e.entitlementType === "CREDITS"
                    ? `${e.creditsRemaining} de ${e.creditsTotal} clases disponibles`
                    : e.validUntil
                      ? `Vigente hasta ${e.validUntil}`
                      : "Vigente sin vencimiento"}
                </span>

                {blocked ? (
                  <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
                    Tu pago no está al día, por eso no podés reservar.
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
