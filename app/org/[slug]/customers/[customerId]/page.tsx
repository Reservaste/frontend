import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers } from "@/app/actions/admin";
import { getCustomerPayments } from "@/app/actions/billing";
import { listServices } from "@/app/actions/services";
import {
  listOrganizationServicePlans,
  listPaymentPlanOptions,
} from "@/app/actions/service-plans";
import { StatusBadge } from "@/components/status";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { PaymentList, RegisterPaymentForm } from "./customer-forms";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const [customers, services, payments, planOptions, allPlans] = await Promise.all([
    getCustomers(slug),
    listServices(slug),
    getCustomerPayments(slug, customerId),
    // What can be charged today (ADR-0024), and every plan ever offered,
    // so a payment for a plan that was since retired still says what it
    // bought.
    listPaymentPlanOptions(slug),
    listOrganizationServicePlans(slug),
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
        <h2 className="text-sm font-semibold">Pagos</h2>
        <PaymentList
          organizationSlug={slug}
          customerId={customerId}
          payments={payments}
          services={services}
          plans={allPlans}
          currency={organization.currency}
        />
        <RegisterPaymentForm
          organizationSlug={slug}
          customerId={customerId}
          services={services}
          plans={planOptions}
          currency={organization.currency}
        />
      </section>
    </div>
  );
}
