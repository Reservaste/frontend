import { getMyMakeupCredits } from "@/app/actions/customer";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Mis créditos" };

const ORIGIN_LABEL: Record<string, string> = {
  CUSTOMER_RELEASE: "Liberaste el cupo a tiempo",
  ORGANIZATION_CANCELLED: "El negocio canceló la clase",
  MANUAL: "Cortesía del negocio",
};

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-UY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * ADR-0025: "no es un paquete prepago" -- cada fila es un crédito real,
 * ganado por una reserva perdida. status/is_expired vienen calculados en
 * SQL: esta página sólo los muestra, nunca los recalcula.
 */
export default async function MyMakeupCreditsPage() {
  const credits = await getMyMakeupCredits();
  const usable = credits.filter((c) => c.status === "AVAILABLE" && !c.isExpired);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <h1 className="text-xl">Mis créditos</h1>

      {usable.length > 0 ? (
        <p className="rounded-xl bg-success-subtle px-4 py-3 text-sm text-success">
          Tenés {usable.length} {usable.length === 1 ? "crédito" : "créditos"} para recuperar una clase.
        </p>
      ) : null}

      {credits.length === 0 ? (
        <EmptyState
          title="Sin créditos"
          description="Si liberás un cupo con suficiente anticipación, puede quedarte un crédito acá para recuperar la clase dentro del mes."
        />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {credits.map((c) => {
            const usableNow = c.status === "AVAILABLE" && !c.isExpired;
            const tone = usableNow ? "success" : c.status === "CONSUMED" ? "neutral" : "danger";
            const label = usableNow
              ? "Disponible"
              : c.status === "CONSUMED"
                ? "Usado"
                : c.status === "REVOKED"
                  ? "Anulado"
                  : "Vencido";

            return (
              <li key={c.creditId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-medium">{c.serviceName}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {c.organizationName} · {ORIGIN_LABEL[c.origin] ?? c.origin}
                  </span>
                  <span className="tnum text-xs text-muted-foreground">Vence el {formatDate(c.expiresOn)}</span>
                </div>
                <StatusBadge tone={tone as "success" | "neutral" | "danger"}>{label}</StatusBadge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
