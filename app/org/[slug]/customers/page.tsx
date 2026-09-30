import Link from "next/link";
import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { DataList, DataListRow } from "@/components/ui/table";
import { ChevronRight } from "@/components/icons";
import { ManagedCustomerForm } from "./managed-customer-form";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { permissions } = await requireOrganizationMembership(slug);
  const customers = await getCustomers(slug);
  // ADR-0033 `MANAGE_CUSTOMERS`: signing customers up. The list itself is
  // for every member (a role that cannot see customers cannot take roll).
  const canManageCustomers = hasOrgPermission(permissions, "MANAGE_CUSTOMERS");

  const initials = (name: string) =>
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Clientes"
        description={`${customers.filter((c) => c.isActive).length} habilitados`}
      />

      {/*
        ADR-0043 (corrección post-review de seguridad): "Cliente con cuenta
        existente" (alta por email, enroll_customer_by_email()) se sacó de
        acá -- esa RPC le daba el vínculo de cliente a quien tuviera ese
        email registrado, sin probar que fuera la persona real; su `grant
        execute` fue revocado. "Cliente sin cuenta" (ADR-0026) queda como
        el único camino, y también cubre a alguien que ya tiene cuenta
        propia: el link de WhatsApp activa igual, la persona entra con su
        cuenta existente (o se registra si no tiene) y
        claim_customer_activation() vincula esa sesión al cliente -- nunca
        compara email, sólo exige tener el token del link.
      */}
      {canManageCustomers ? (
        <div className="flex flex-wrap gap-2">
          <ManagedCustomerForm organizationSlug={slug} />
        </div>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          description={
            canManageCustomers
              ? "Dalo de alta con nombre y teléfono -- no hace falta que tenga cuenta. Si ya tiene cuenta propia, igual funciona: al activar el link de WhatsApp entra con esa cuenta."
              : "Cuando el negocio dé de alta clientes, van a aparecer acá."
          }
        />
      ) : (
        <DataList>
          {customers.map((customer) => (
            <DataListRow key={customer.customerId}>
              <Link
                href={`/org/${slug}/customers/${customer.customerId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary-on-subtle">
                  {initials(customer.fullName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.fullName}</span>
                {customer.profileId === null ? (
                  <StatusBadge tone="warning">Sin cuenta</StatusBadge>
                ) : null}
                {!customer.isActive ? <StatusBadge tone="neutral">Inactivo</StatusBadge> : null}
                <ChevronRight className="shrink-0 text-muted-foreground" />
              </Link>
            </DataListRow>
          ))}
        </DataList>
      )}
    </div>
  );
}
