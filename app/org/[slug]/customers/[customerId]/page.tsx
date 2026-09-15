import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { getCustomerEntitlements, getCustomerPayments } from "@/app/actions/billing";
import { listServices } from "@/app/actions/services";
import { StatusBadge } from "@/components/status";
import { Breadcrumbs } from "@/components/breadcrumbs";
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

  const initials = customer.fullName
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Clientes", href: `/org/${slug}/customers` },
          { label: customer.fullName },
        ]}
      />

      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-base font-semibold text-primary">
          {initials}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">{customer.fullName}</h1>
          <StatusBadge tone={customer.isActive ? "success" : "neutral"} className="self-start">
            {customer.isActive ? "Activo" : "Inactivo"}
          </StatusBadge>
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Servicios habilitados</h2>
        <EntitlementList
          organizationSlug={slug}
          customerId={customerId}
          entitlements={entitlements}
          services={services}
        />
        <GrantEntitlementForm organizationSlug={slug} customerId={customerId} services={services} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Pagos</h2>
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
