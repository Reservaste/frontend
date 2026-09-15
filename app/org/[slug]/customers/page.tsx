import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status";
import { EnrollForm } from "./enroll-form";

export const metadata = { title: "Clientes" };

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const customers = await getCustomers(slug);

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

      <EnrollForm organizationSlug={slug} />

      {customers.length === 0 ? (
        <EmptyState
          title="Todavía no hay clientes"
          description="Habilitá a alguien por email para que pueda reservar. La persona tiene que tener cuenta creada."
        />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <Link
                href={`/org/${slug}/customers/${customer.customerId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
                  {initials(customer.fullName)}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{customer.fullName}</span>
                {!customer.isActive ? <StatusBadge tone="neutral">Inactivo</StatusBadge> : null}
                <svg viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-muted-foreground">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
