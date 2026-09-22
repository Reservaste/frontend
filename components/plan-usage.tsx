import type { PlanUsage } from "@/app/actions/platform";
import { StatusBadge } from "@/components/status";

const STATUS: Record<PlanUsage["subscriptionStatus"], { label: string; tone: "success" | "warning" | "danger" }> = {
  ACTIVE: { label: "Al día", tone: "success" },
  TRIALING: { label: "En prueba", tone: "warning" },
  PAST_DUE: { label: "Pago pendiente", tone: "danger" },
  SUSPENDED: { label: "Suspendida", tone: "danger" },
};

function UsageRow({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(used / Math.max(limit, 1), 1);
  const atLimit = !unlimited && used >= limit;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={`tnum ${atLimit ? "font-medium text-destructive" : "text-muted-foreground"}`}>
          {used}
          {unlimited ? " · sin límite" : ` / ${limit}`}
        </span>
      </div>
      {!unlimited ? (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${atLimit ? "bg-destructive" : ratio >= 0.8 ? "bg-warning" : "bg-primary"}`}
            style={{ width: `${Math.max(ratio * 100, used > 0 ? 6 : 0)}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

export function PlanUsageCard({ usage }: { usage: PlanUsage }) {
  const status = STATUS[usage.subscriptionStatus];

  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="eyebrow text-muted-foreground">Tu plan</span>
          <span className="text-lg font-semibold">
            {usage.planName ?? "Sin plan"}
            {usage.monthlyPriceUsd !== null ? (
              <span className="text-sm font-normal text-muted-foreground"> · {usage.monthlyPriceUsd} USD/mes</span>
            ) : null}
          </span>
        </div>
        <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
      </div>

      {usage.subscriptionStatus === "TRIALING" && usage.trialEndsAt ? (
        <p className="rounded-lg bg-warning-subtle px-3 py-2 text-sm text-warning-foreground">
          Tu prueba termina el {new Date(usage.trialEndsAt).toLocaleDateString("es-UY")}.
        </p>
      ) : null}

      {usage.subscriptionStatus === "PAST_DUE" || usage.subscriptionStatus === "SUSPENDED" ? (
        <p className="rounded-lg bg-destructive-subtle px-3 py-2 text-sm text-destructive">
          Mientras la suscripción esté al día vas a poder volver a crear servicios, horarios y clientes.
          Tus reservas y tu página pública siguen funcionando.
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <UsageRow label="Servicios" used={usage.servicesUsed} limit={usage.servicesLimit} />
        <UsageRow label="Recursos" used={usage.resourcesUsed} limit={usage.resourcesLimit} />
        <UsageRow label="Clientes" used={usage.customersUsed} limit={usage.customersLimit} />
        <UsageRow label="Equipo" used={usage.teamUsed} limit={usage.teamLimit} />
      </div>
    </div>
  );
}
