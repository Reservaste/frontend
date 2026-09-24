import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listServices } from "@/app/actions/services";
import { listServicePlans } from "@/app/actions/service-plans";
import { listPlanChangeRequests } from "@/app/actions/plan-changes";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { NewPlanDialog } from "./plan-forms";
import { PlanChangeRequests } from "./plan-change-requests";
import { PlansList } from "./plans-list";

export const metadata = { title: "Planes" };

/**
 * The organization's whole price list -- a top-level section, sibling of
 * Servicios/Clientes/Pagos.
 *
 * Moved out of `services/[serviceId]/plans/` (pedido del dueño, después de
 * ADR-0029: "los planes pueden o no ser por servicio, ahora están 100%
 * sujetos [a un service]" ya no es cierto -- un plan cubre uno, varios o
 * todos los servicios, así que gestionarlo hacía falta "entrar" a uno de
 * ellos, lo cual ya no representa el dominio). Esta pantalla lista TODOS
 * los planes de la organización sin tener que entrar a ningún servicio; el
 * filtro por servicio (`PlansList`) es una comodidad, no un requisito para
 * ver la lista completa.
 *
 * Four states, like every screen that reads data: the skeleton lives in
 * `loading.tsx`, the failed read is an Alert (an empty list would claim the
 * business has no prices), the empty list is an EmptyState with the way
 * out, and the list itself is the success state.
 */
export default async function PlansPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ serviceId?: string }>;
}) {
  const { slug } = await params;
  const { serviceId } = await searchParams;
  const { organization, membership, permissions } = await requireOrganizationMembership(slug);
  // ADR-0033: the price list is for everyone (it is public anyway), but the
  // plan-change queue is payment work -- VIEW_PAYMENTS to see it,
  // MANAGE_PAYMENTS to resolve it (docs/api.md, Fase 32).
  const canViewPayments = hasOrgPermission(permissions, "VIEW_PAYMENTS");
  const canManagePayments = hasOrgPermission(permissions, "MANAGE_PAYMENTS");

  const [services, result, planChangeRequests] = await Promise.all([
    listServices(slug),
    listServicePlans(slug),
    // Sólo los pendientes: un pedido cobrado se cierra solo por trigger
    // (ADR-0035), así que esta lista es trabajo real, no historial.
    canViewPayments ? listPlanChangeRequests(slug) : Promise.resolve([]),
  ]);

  // Same rule the service's payment configuration already had: staff run
  // the desk, the owner sets the prices. Note that RLS on service_plans
  // allows any organization member to write, so this is a product policy,
  // not the security boundary.
  const canEdit = membership.role === "OWNER";
  const activeCount = result.plans.filter((plan) => plan.isActive).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Planes"
        description="Los precios de tu organización: cuánto cuesta cada uno y qué servicios cubre"
      />

      {result.error ? (
        <Alert tone="danger" title="No pudimos cargar los planes">
          Probá recargar la página. Si sigue pasando, es un problema nuestro, no de tu
          configuración.
        </Alert>
      ) : null}

      {/* Arriba de la lista a propósito: es lo único de esta pantalla que
          espera una respuesta de alguien. */}
      <PlanChangeRequests
        organizationSlug={slug}
        requests={planChangeRequests}
        timezone={organization.timezone}
        canResolve={canManagePayments}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Planes {result.plans.length > 0 ? `(${activeCount} ${activeCount === 1 ? "activo" : "activos"})` : null}
        </h2>
        {result.plans.length > 0 ? (
          <NewPlanDialog organizationSlug={slug} services={services} currency={organization.currency} canEdit={canEdit} />
        ) : null}
      </div>

      {result.error ? null : result.plans.length === 0 ? (
        <EmptyState
          title="Todavía no hay planes"
          description="Un plan dice cuánto cuesta y qué da: un turno suelto, turnos fijos por semana, o sin límite dentro del período. Elegís qué servicios cubre -- uno, varios o todos. Sin al menos uno no se pueden registrar pagos."
          action={
            <NewPlanDialog
              organizationSlug={slug}
              services={services}
              currency={organization.currency}
              canEdit={canEdit}
              variant="outline"
            />
          }
        />
      ) : (
        <PlansList
          organizationSlug={slug}
          plans={result.plans}
          services={services}
          canEdit={canEdit}
          currency={organization.currency}
          initialServiceId={serviceId}
        />
      )}

      {/* The invariant that gets misread the most, said next to the button
          that triggers it (ADR-0024, invariantes nuevos). */}
      {canEdit && result.plans.length > 0 ? (
        <Alert tone="info" size="sm">
          Desactivar un plan solo lo saca de la lista de precios. A quien ya pagó no se le corta la
          cobertura: su pago sigue valiendo hasta que termine el período que compró.
        </Alert>
      ) : null}

      {!canEdit ? (
        <p className="text-xs text-muted-foreground">Solo el dueño puede cambiar los precios.</p>
      ) : null}
    </div>
  );
}
