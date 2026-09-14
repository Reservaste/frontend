import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { EnrollForm } from "./enroll-form";

export default async function CustomersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireOrganizationMembership(slug);
  const customers = await getCustomers(slug);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Clientes</h1>

      <EnrollForm organizationSlug={slug} />

      {customers.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">Todavía no hay clientes habilitados.</p>
        </div>
      ) : (
        <ul className="flex flex-col divide-y rounded-lg border">
          {customers.map((customer) => (
            <li key={customer.customerId}>
              <Link
                href={`/org/${slug}/customers/${customer.customerId}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted"
              >
                <span className="text-sm">{customer.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {customer.isActive ? "Activo" : "Inactivo"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
