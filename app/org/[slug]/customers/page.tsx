import Link from "next/link";
import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/status";
import { DataList, DataListRow } from "@/components/ui/table";
import { ChevronRight } from "@/components/icons";
import { EnrollForm } from "./enroll-form";
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
        "Cliente sin cuenta" va primero a propósito (ADR-0026): es el
        camino sin fricción, el que no depende de que la persona se haya
        registrado antes -- justo lo que el feedback original pedía.
        "Cliente con cuenta" queda segundo, para cuando ya se registró por
        su cuenta. Antes el orden era al revés y el botón por email se
        llamaba "Habilitar cliente" a secas, lo bastante genérico como
        para leerse como "la forma normal" -- llevaba al dueño derecho al
        único camino que sí exige registro previo.
      */}
      {canManageCustomers ? (
        <div className="flex flex-wrap gap-2">
          <ManagedCustomerForm organizationSlug={slug} />
          <EnrollForm organizationSlug={slug} />
        </div>
      ) : null}

      {customers.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          description={
            canManageCustomers
              ? "Dalo de alta con nombre y teléfono -- no hace falta que tenga cuenta. Si ya se registró por su cuenta, usá 'Cliente con cuenta existente'."
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
