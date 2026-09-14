import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { getCustomerEntitlements, getCustomerPayments } from "@/app/actions/billing";
import { listServices } from "@/app/actions/services";
import {
  EntitlementList,
  GrantEntitlementForm,
  PaymentList,
  RegisterPaymentForm,
} from "./customer-forms";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  await requireOrganizationMembership(slug);

  const [customers, services, entitlements, payments] = await Promise.all([
    getCustomers(slug),
    listServices(slug),
    getCustomerEntitlements(slug, customerId),
    getCustomerPayments(slug, customerId),
  ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6">
      <div className="flex flex-col gap-1">
        <Link href={`/org/${slug}/customers`} className="text-sm text-muted-foreground hover:text-foreground">
          ← Clientes
        </Link>
        <h1 className="text-xl font-semibold">{customer.fullName}</h1>
        <p className="text-sm text-muted-foreground">{customer.isActive ? "Activo" : "Inactivo"}</p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Servicios habilitados</h2>
        <EntitlementList
          organizationSlug={slug}
          customerId={customerId}
          entitlements={entitlements}
          services={services}
        />
        <GrantEntitlementForm organizationSlug={slug} customerId={customerId} services={services} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Pagos</h2>
        <PaymentList organizationSlug={slug} customerId={customerId} payments={payments} />
        <RegisterPaymentForm
          organizationSlug={slug}
          customerId={customerId}
          entitlements={entitlements}
          services={services}
        />
      </section>
    </div>
  );
}
