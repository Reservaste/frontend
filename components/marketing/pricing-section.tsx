import Link from "next/link";
import { cn } from "cn";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckIcon } from "@/components/icons";

/**
 * Pricing (ADR-0030 §3.7) -- the only dynamic part of the landing. Reads
 * `plans` directly in this server component: the table is public
 * (`plans_select_all using (true)`), so an anon-key client can read it same
 * as any visitor's browser could. Never hardcode a price here -- a stale
 * price quoted to a visitor is worse than the section failing honestly.
 */
type PlanRow = {
  code: string;
  name: string;
  monthly_price_usd: number | string;
  max_services: number | null;
  max_resources: number | null;
  max_customers: number | null;
  max_team_members: number | null;
};

const LIMITS: { key: keyof PlanRow; unit: string }[] = [
  { key: "max_services", unit: "servicios" },
  { key: "max_resources", unit: "recursos" },
  { key: "max_customers", unit: "clientes" },
  { key: "max_team_members", unit: "en el equipo" },
];

function formatLimit(value: number | null, unit: string): string {
  if (value === null) return "Sin límite";
  return `${value} ${unit}`;
}

/** Three skeleton cards at the exact height of `PriceCard`, so the section
 * doesn't jump when the query resolves. Exported so `app/page.tsx` can use
 * it as the `Suspense` fallback around `<PricingSection />`. */
export function PricingSkeleton() {
  return (
    <div className="grid gap-6 sm:grid-cols-3" role="status" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando planes…</span>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-card">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-9 w-32" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-2/3" />
          </div>
          <Skeleton className="h-11 w-full rounded-lg" />
        </div>
      ))}
    </div>
  );
}

/** Same panel for a failed query and a catalogue with zero public rows --
 * from a visitor's chair those are the same fact ("no puedo ver precios
 * ahora"), so they get the same message (§3.7). Never a hardcoded fallback
 * price here. */
function PricingUnavailable() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/80 bg-surface-sunken/60 px-6 py-12 text-center">
      <p className="font-semibold">No pudimos cargar los planes ahora mismo.</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Escribinos y te los pasamos directamente.
      </p>
      <Link href="/contacto" className={buttonVariants({ size: "touch" })}>
        Contactar
      </Link>
    </div>
  );
}

function PriceCard({ plan, featured }: { plan: PlanRow; featured: boolean }) {
  const price = Number(plan.monthly_price_usd);

  return (
    <div
      aria-label={featured ? `Plan ${plan.name}, el más elegido` : `Plan ${plan.name}`}
      className={cn(
        "flex flex-col gap-5 rounded-2xl border bg-card p-6 shadow-card",
        featured && "border-primary shadow-raised sm:-translate-y-2",
      )}
    >
      {featured ? (
        <span className="eyebrow inline-flex w-fit items-center rounded-full bg-primary px-3 py-1 text-primary-foreground">
          El más elegido
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <span className="text-lg font-semibold">{plan.name}</span>
        <div className="flex items-baseline gap-1">
          <span className="tnum text-3xl font-bold">
            {Number.isFinite(price) ? `USD ${price}` : "—"}
          </span>
          <span className="text-sm text-muted-foreground">/mes</span>
        </div>
      </div>
      <ul className="flex flex-col gap-2 text-sm">
        {LIMITS.map(({ key, unit }) => (
          <li key={key} className="flex items-start gap-2">
            <CheckIcon className="mt-0.5 shrink-0 text-success" />
            <span>{formatLimit(plan[key] as number | null, unit)}</span>
          </li>
        ))}
      </ul>
      <Link
        href="/contacto"
        className={buttonVariants({ size: "touch", variant: featured ? "default" : "outline" })}
      >
        Empezar con {plan.name}
      </Link>
    </div>
  );
}

export async function PricingSection() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("code,name,monthly_price_usd,max_services,max_resources,max_customers,max_team_members")
    .eq("is_public", true)
    .order("sort_order", { ascending: true });

  if (error || !data || data.length === 0) {
    return <PricingUnavailable />;
  }

  return (
    <div className="grid gap-6 sm:grid-cols-3">
      {data.map((plan) => (
        <PriceCard key={plan.code} plan={plan} featured={plan.code === "pro"} />
      ))}
    </div>
  );
}
