import Link from "next/link";
import type { AuditLogCursor } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getOrganizationAuditLog } from "@/app/actions/audit";
import { getCustomers } from "@/app/actions/admin";
import { listOrganizationServicePlans } from "@/app/actions/service-plans";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/page-header";
import { NoPermission } from "@/components/no-permission";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/empty-state";
import { DataList, DataListRow } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { auditActionDetails, auditActionTitle, auditActorLabel, auditLogStartedLabel } from "@/lib/audit-labels";

export const metadata = { title: "Registro de actividad" };

const PAGE_SIZE = 50;

/**
 * ADR-0032: read-only audit log for the OWNER, under Configuración -- it is
 * about the business, not a front-desk operation, and everything else here
 * is already owner territory.
 *
 * Two things the page says explicitly because the data cannot (docs/api.md,
 * Fase 30): since when it records (no backfill -- an empty list without that
 * caption reads as "nothing happened"), and what it does not include.
 */
export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ antes?: string; antesId?: string }>;
}) {
  const { slug } = await params;
  const { antes, antesId } = await searchParams;
  const { organization, membership } = await requireOrganizationMembership(slug);

  const header = (
    <>
      <BackLink href={`/org/${slug}/settings`}>Configuración</BackLink>
      <PageHeader
        title="Registro de actividad"
        description="Pagos, reservas hechas por el equipo, planes y estado de la cuenta: quién hizo qué y cuándo"
      />
    </>
  );

  // The RPC answers NOT_AUTHORIZED to STAFF anyway; the menu entry is not
  // shown to them either, so this only covers a typed URL.
  if (membership.role !== "OWNER") {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
        {header}
        <NoPermission title="Sólo el dueño puede ver el registro de actividad" />
      </div>
    );
  }

  // Fase 30b: el cursor es (created_at, id) -- si falta cualquiera de los dos
  // params, no es un cursor válido a medias, es directamente "sin cursor":
  // mostramos la primera página en vez de mandarle a la RPC una mitad sola
  // (que además ahora rechaza explícitamente con INVALID_CURSOR).
  const cursor: AuditLogCursor | undefined =
    antes && antesId ? { beforeCreatedAt: antes, beforeId: antesId } : undefined;

  const [result, customers, plans] = await Promise.all([
    getOrganizationAuditLog(slug, { limit: PAGE_SIZE, cursor }),
    getCustomers(slug),
    listOrganizationServicePlans(slug),
  ]);

  const names = {
    customers: Object.fromEntries(customers.map((c) => [c.customerId, c.fullName])),
    plans: Object.fromEntries(plans.map((p) => [p.id, p.name])),
  };

  // ADR-0014: in the organization's zone, not the server's.
  const when = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const last = result.entries.at(-1);
  const hasMore = result.entries.length === PAGE_SIZE && last !== undefined;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      {header}

      {result.error ? (
        <Alert tone="danger" title="No pudimos cargar el registro">
          {result.error}
        </Alert>
      ) : result.entries.length === 0 ? (
        <EmptyState
          title={cursor ? "No hay nada más antiguo" : "Todavía no hay nada registrado"}
          description={
            cursor
              ? `El registro empezó el ${auditLogStartedLabel()}.`
              : "Cuando alguien registre o anule un pago, anote o cancele a un cliente, o cambie un plan, va a aparecer acá."
          }
        />
      ) : (
        <DataList>
          {result.entries.map((entry) => {
            const details = auditActionDetails(entry, organization.currency, names);
            return (
              <DataListRow key={entry.id} className="flex flex-col gap-1 px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className="text-sm font-medium">{auditActionTitle(entry)}</span>
                  <span className="tnum text-xs text-muted-foreground">
                    {when.format(new Date(entry.createdAt))}
                  </span>
                </div>
                {details.length > 0 ? (
                  <span className="text-xs text-muted-foreground">{details.join(" · ")}</span>
                ) : null}
                <span className="text-xs text-muted-foreground">Por: {auditActorLabel(entry)}</span>
              </DataListRow>
            );
          })}
        </DataList>
      )}

      <div className="flex flex-wrap gap-2">
        {cursor ? (
          <Link href={`/org/${slug}/settings/registro`} className={buttonVariants({ variant: "ghost", size: "touch" })}>
            Volver a lo más reciente
          </Link>
        ) : null}
        {hasMore ? (
          <Link
            href={`/org/${slug}/settings/registro?antes=${encodeURIComponent(last.createdAt)}&antesId=${encodeURIComponent(last.id)}`}
            className={buttonVariants({ variant: "outline", size: "touch" })}
          >
            Ver anteriores
          </Link>
        ) : null}
      </div>
    </div>
  );
}
