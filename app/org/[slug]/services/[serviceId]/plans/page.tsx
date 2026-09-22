import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { listServices } from "@/app/actions/services";
import { listServicePlans } from "@/app/actions/service-plans";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PageHeader } from "@/components/page-header";
import { Alert } from "@/components/ui/alert";
import { DataList } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ServiceTabs } from "../service-tabs";
import { NewPlanDialog, PlanRow } from "./plan-forms";

export const metadata = { title: "Planes" };

/**
 * The price list of one service (ADR-0024).
 *
 * A plan is a price plus what that price buys: a single slot, N fixed
 * weekly slots, or no limit within the period. One service has several at
 * once -- that's the whole reason `billing_type`/`billing_cycle`/`price`
 * moved off the Service, where a single column couldn't express it.
 *
 * Four states, like every screen that reads data: the skeleton lives in
 * `loading.tsx`, the failed read is an Alert (an empty list would claim the
 * business has no prices), the empty list is an EmptyState with the way
 * out, and the list itself is the success state.
 */
export default async function ServicePlansPage({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);

  const [services, result] = await Promise.all([
    listServices(slug),
    listServicePlans(slug, serviceId),
  ]);

  const service = services.find((s) => s.id === serviceId);
  if (!service) {
    notFound();
  }

  // Same rule the service's payment configuration already had
  // (updateServiceSettings): staff run the desk, the owner sets the prices.
  // Note that RLS on service_plans allows any organization member to write,
  // so this is a product policy, not the security boundary.
  const canEdit = membership.role === "OWNER";
  const activeCount = result.plans.filter((plan) => plan.isActive).length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Servicios", href: `/org/${slug}/services` },
          { label: service.name },
        ]}
      />

      <PageHeader
        title={service.name}
        description="Los precios de este servicio y qué da cada uno"
      />

      <ServiceTabs organizationSlug={slug} serviceId={serviceId} />

      {result.error ? (
        <Alert tone="danger" title="No pudimos cargar los planes">
          Probá recargar la página. Si sigue pasando, es un problema nuestro, no de tu
          configuración.
        </Alert>
      ) : null}

      {!service.paymentRequired ? (
        <Alert tone="warning" title="Este servicio no exige pago para reservar">
          Podés listar precios igual, pero nadie queda bloqueado por no pagar y los planes de
          turnos fijos por semana no se pueden crear: sin un pago vigente no hay de dónde leer la
          frecuencia. Se activa en la configuración del servicio, en la pestaña Horarios.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">
          Planes {result.plans.length > 0 ? `(${activeCount} ${activeCount === 1 ? "activo" : "activos"})` : null}
        </h2>
        {result.plans.length > 0 ? (
          <NewPlanDialog
            organizationSlug={slug}
            serviceId={serviceId}
            paymentRequired={service.paymentRequired}
            currency={organization.currency}
            canEdit={canEdit}
          />
        ) : null}
      </div>

      {result.error ? null : result.plans.length === 0 ? (
        <EmptyState
          title="Todavía no hay planes"
          description="Un plan dice cuánto cuesta y qué da: un turno suelto, turnos fijos por semana, o sin límite dentro del período. Sin al menos uno no se pueden registrar pagos de este servicio."
          action={
            <NewPlanDialog
              organizationSlug={slug}
              serviceId={serviceId}
              paymentRequired={service.paymentRequired}
              currency={organization.currency}
              canEdit={canEdit}
              variant="outline"
            />
          }
        />
      ) : (
        <DataList>
          {result.plans.map((plan) => (
            <PlanRow
              key={plan.id}
              organizationSlug={slug}
              serviceId={serviceId}
              plan={plan}
              currency={organization.currency}
              canEdit={canEdit}
            />
          ))}
        </DataList>
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
