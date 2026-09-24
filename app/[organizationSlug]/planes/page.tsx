import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPublicOrganization,
  listPublicServicePlans,
  listPublicServices,
  type PublicServicePlan,
} from "@/app/actions/public";
import { getMyPlanChangeRequests } from "@/app/actions/plan-changes";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { BrandTheme } from "@/components/brand-theme";
import { BackLink } from "@/components/back-link";
import { OrganizationLogo } from "@/components/organization-logo";
import { StatusBadge } from "@/components/status";
import { Alert } from "@/components/ui/alert";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InfoIcon } from "@/components/icons";
import { formatMoney } from "@/lib/money";
import {
  PLAN_KIND_LABEL,
  planBillingLabel,
  planPriceSuffix,
  planScopeLabel,
  planSummary,
  QUOTA_SCOPE_LABEL,
} from "@/lib/plan-labels";
import { PlanRequestButton } from "./plan-request-button";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  const organization = await getPublicOrganization(organizationSlug);
  return { title: organization ? `Planes · ${organization.name}` : "Planes" };
}

/**
 * El catálogo público de planes de un negocio (Fase 28 / ADR-0035).
 *
 * Es la pantalla a la que llega alguien que se chocó con
 * `OVER_PLAN_QUOTA`/`OUTSIDE_PLAN_QUOTA` al reservar: esos dos rechazos no
 * se arreglan pagando de nuevo ni eligiendo otro horario, se arreglan
 * cambiando de plan. Hasta ahora ese link iba a `/me/servicios`, que sólo
 * muestra el plan que la persona **ya** tiene — el callejón sin salida.
 *
 * Pública sin login a propósito: los precios son un dato público (Fase 22,
 * `service_plans_select_public`) y esconderlos detrás de un login es
 * esconder lo único que alguien viene a mirar. El *pedido* sí necesita
 * sesión, y ahí se ofrece el login llevando esta misma URL de vuelta
 * (ADR-0015).
 *
 * `?servicio=` acota la lista a los planes que cubren ese servicio, que es
 * la forma que tiene sentido cuando venís de un slot concreto.
 */
export default async function PublicPlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationSlug: string }>;
  searchParams: Promise<{ servicio?: string }>;
}) {
  const { organizationSlug } = await params;
  const { servicio } = await searchParams;

  const organization = await getPublicOrganization(organizationSlug);
  if (!organization) {
    notFound();
  }

  const [plans, services] = await Promise.all([
    listPublicServicePlans(organizationSlug, servicio ?? null),
    listPublicServices(organization.id),
  ]);

  const serviceNameById = Object.fromEntries(services.map((s) => [s.id, s.name]));
  const filteredService = servicio ? (serviceNameById[servicio] ?? null) : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Sólo para no ofrecer un botón que ya se usó. No decide nada: la RPC es
  // idempotente y un pedido pendiente no habilita ni bloquea una reserva.
  const myRequests = user ? await getMyPlanChangeRequests() : [];
  const pendingHere = myRequests.filter(
    (request) => request.resolution === null && request.organizationSlug === organizationSlug,
  );
  const pendingPlanIds = new Set(pendingHere.map((request) => request.planId));

  const returnTo = servicio
    ? `/${organizationSlug}/planes?servicio=${encodeURIComponent(servicio)}`
    : `/${organizationSlug}/planes`;

  return (
    <BrandTheme color={organization.brandColor} className="flex flex-1 flex-col">
      <header className="brand-wash border-b border-border/70 bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-2xl flex-wrap items-center justify-between gap-2 px-5 py-3">
          <Brand href={user ? "/dashboard" : "/"} />
          <Link
            href={
              user
                ? `/me?org=${encodeURIComponent(organizationSlug)}`
                : `/login?returnTo=${encodeURIComponent(returnTo)}`
            }
            className={buttonVariants({ variant: "ghost", size: "touch" })}
          >
            {user ? "Mi agenda" : "Ingresar"}
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 border-t border-border/70 px-5 py-4">
          <OrganizationLogo name={organization.name} logoPath={organization.logoPath} size="md" />
          <div className="flex min-w-0 flex-col">
            <h1 className="truncate text-lg">Planes de {organization.name}</h1>
            <p className="text-xs text-muted-foreground">
              {filteredService
                ? `Lo que podés contratar para ${filteredService}`
                : "Lo que podés contratar y qué incluye cada opción"}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-5 py-5">
        <BackLink href={`/${organizationSlug}`}>Agenda de {organization.name}</BackLink>

        {/* Lo primero, no lo último: la persona está a punto de apretar un
            botón que no cambia su plan. */}
        <Alert tone="info" icon={<InfoIcon />} size="sm">
          Pedir un plan no lo activa ni lo cobra: le avisa al negocio, que te va a contactar para
          confirmarlo y cobrarlo.
        </Alert>

        {pendingHere.length > 0 ? (
          <Alert tone="warning" title="Ya tenés un pedido esperando respuesta">
            {pendingHere.map((request) => request.planName).join(" · ")}. El negocio todavía no lo
            confirmó.
          </Alert>
        ) : null}

        {filteredService ? (
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone="primary">Planes para {filteredService}</StatusBadge>
            <Link
              href={`/${organizationSlug}/planes`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Ver todos los planes
            </Link>
          </div>
        ) : null}

        {plans.length === 0 ? (
          <EmptyState
            title={
              filteredService
                ? `Todavía no hay planes publicados para ${filteredService}`
                : "Todavía no hay planes publicados"
            }
            description="Escribile al negocio para saber cómo contratar. Si ya tenías un plan, seguís cubierto hasta que termine el período que pagaste."
            action={
              <Link
                href={`/${organizationSlug}`}
                className={buttonVariants({ variant: "outline", size: "touch" })}
              >
                Volver a la agenda
              </Link>
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                canRequest={Boolean(user)}
                alreadyPending={pendingPlanIds.has(plan.id)}
                returnTo={returnTo}
              />
            ))}
          </ul>
        )}
      </main>

      <footer className="mx-auto w-full max-w-2xl px-5 pb-8 text-center">
        <p className="text-xs text-muted-foreground">
          Precios de {organization.name} · con Reservaste
        </p>
      </footer>
    </BrandTheme>
  );
}

/**
 * Vocabulario genérico y prestado de `lib/plan-labels.ts` (CLAUDE.md): un
 * `DROP_IN` es "turno suelto", nunca "clase suelta" — la misma tarjeta la
 * mira un consultorio, una cancha y un estudio.
 */
function PlanCard({
  plan,
  canRequest,
  alreadyPending,
  returnTo,
}: {
  plan: PublicServicePlan;
  canRequest: boolean;
  alreadyPending: boolean;
  returnTo: string;
}) {
  // La RPC ya resolvió el conjunto cubierto contra servicios **activos**:
  // armar el mapa desde la propia fila evita que un plan quede etiquetado
  // con un servicio que el listado público sí trae y la RPC descartó.
  const serviceNameById = Object.fromEntries(
    plan.serviceIds.map((id, index) => [id, plan.serviceNames[index] ?? "Servicio"]),
  );

  return (
    <li className="flex flex-col gap-3 rounded-2xl border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold">{plan.name}</span>
          <span className="text-sm text-muted-foreground">
            {planSummary(plan.planKind, plan.weeklyQuota)}
          </span>
        </div>
        <div className="flex flex-col items-end">
          <span className="tnum text-lg font-semibold">
            {formatMoney(plan.price, plan.currency)}
            <span className="text-sm font-normal text-muted-foreground">
              {planPriceSuffix(plan.billingType, undefined, plan.billingCycle)}
            </span>
          </span>
          <span className="text-xs text-muted-foreground">
            {planBillingLabel(plan.billingType, plan.billingCycle)}
          </span>
        </div>
      </div>

      {plan.description ? <p className="text-sm text-muted-foreground">{plan.description}</p> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <StatusBadge tone="neutral">{PLAN_KIND_LABEL[plan.planKind]}</StatusBadge>
        <StatusBadge tone="neutral">
          {planScopeLabel(plan.appliesToAllServices, plan.serviceIds, serviceNameById)}
        </StatusBadge>
        {/* ADR-0029: sólo dice algo cuando el cupo se reparte entre más de
            un servicio; en un plan de uno solo la distinción no existe. */}
        {plan.planKind === "WEEKLY_QUOTA" &&
        plan.quotaScope &&
        (plan.appliesToAllServices || plan.serviceIds.length > 1) ? (
          <StatusBadge tone="neutral">{QUOTA_SCOPE_LABEL[plan.quotaScope]}</StatusBadge>
        ) : null}
      </div>

      {canRequest ? (
        <PlanRequestButton planId={plan.id} alreadyPending={alreadyPending} />
      ) : (
        <Link
          href={`/login?returnTo=${encodeURIComponent(returnTo)}`}
          className={buttonVariants({ variant: "outline", size: "touch", className: "w-full sm:w-auto sm:self-start" })}
        >
          Ingresá para pedir este plan
        </Link>
      )}
    </li>
  );
}
