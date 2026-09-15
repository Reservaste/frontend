import { getMyEntitlements } from "@/app/actions/customer";

export default async function MyServicesPage() {
  const entitlements = await getMyEntitlements();

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 p-4">
      <h1 className="text-xl font-semibold">Mis servicios</h1>

      {entitlements.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Todavía no tenés servicios habilitados. El negocio te los habilita desde su panel.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {entitlements.map((e) => {
            // "Active but unpaid" is the state worth calling out -- it's
            // the difference between having the service and being able to
            // book it today.
            const blocked = e.isActive && e.requiresActivePayment && !e.paidToday;

            return (
              <li key={e.entitlementId} className="flex flex-col gap-1 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{e.serviceName}</span>
                  <span className="text-xs text-muted-foreground">{e.organizationName}</span>
                </div>

                <span className="text-xs text-muted-foreground">
                  {e.entitlementType === "CREDITS"
                    ? `${e.creditsRemaining} de ${e.creditsTotal} clases disponibles`
                    : e.validUntil
                      ? `Vigente hasta ${e.validUntil}`
                      : "Vigente sin vencimiento"}
                </span>

                {!e.isActive ? (
                  <span className="text-xs text-muted-foreground">Revocado por el negocio</span>
                ) : blocked ? (
                  <span className="text-sm">Tu pago no está al día, por eso no podés reservar.</span>
                ) : (
                  <span className="text-xs text-muted-foreground">Podés reservar</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
