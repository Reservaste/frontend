import { notFound } from "next/navigation";
import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomerActivationStatus, getCustomerMakeupCredits, getCustomers } from "@/app/actions/admin";
import { getCustomerPayments } from "@/app/actions/billing";
import { listServices } from "@/app/actions/services";
import {
  listOrganizationServicePlans,
  listPaymentPlanOptions,
} from "@/app/actions/service-plans";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { MakeupCreditsPanel, PaymentList, RegisterPaymentForm } from "./customer-forms";
import { ActivationPanel } from "./activation-panel";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ slug: string; customerId: string }>;
}) {
  const { slug, customerId } = await params;
  const { organization, membership, permissions } = await requireOrganizationMembership(slug);
  // ADR-0033: the payment block (debt, history, register, void) is for a
  // role with VIEW_PAYMENTS; registering and voiding need MANAGE_PAYMENTS.
  // The WhatsApp activation link is MANAGE_CUSTOMERS.
  const canViewPayments = hasOrgPermission(permissions, "VIEW_PAYMENTS");
  const canManagePayments = hasOrgPermission(permissions, "MANAGE_PAYMENTS");
  const canManageCustomers = hasOrgPermission(permissions, "MANAGE_CUSTOMERS");

  const [customers, services, payments, planOptions, allPlans, makeupCredits] = await Promise.all([
    getCustomers(slug),
    listServices(slug),
    canViewPayments ? getCustomerPayments(slug, customerId) : Promise.resolve([]),
    // What can be charged today (ADR-0024), and every plan ever offered,
    // so a payment for a plan that was since retired still says what it
    // bought.
    listPaymentPlanOptions(slug),
    listOrganizationServicePlans(slug),
    getCustomerMakeupCredits(slug, customerId),
  ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) {
    notFound();
  }

  // ADR-0026: only a managed customer (no profileId) can have an
  // activation to manage. Phone isn't part of organization_customers()'s
  // shape, so it's read directly -- customers_select_self_or_staff (Phase
  // 1) already lets any member of this organization read this row.
  let activationPanel: React.ReactNode = null;
  if (customer.profileId === null && canManageCustomers) {
    const supabase = await createClient();
    const [{ data: customerRow }, activationStatus] = await Promise.all([
      supabase.from("customers").select("phone").eq("id", customerId).maybeSingle(),
      getCustomerActivationStatus(slug, customerId),
    ]);

    activationPanel = (
      <ActivationPanel
        organizationSlug={slug}
        customerId={customerId}
        phone={(customerRow?.phone as string | null) ?? null}
        initialStatus={activationStatus}
      />
    );
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

      {activationPanel}

      {canViewPayments ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Pagos</h2>
          <PaymentList
            organizationSlug={slug}
            customerId={customerId}
            payments={payments}
            services={services}
            plans={allPlans}
            currency={organization.currency}
            canManage={canManagePayments}
          />
          {canManagePayments ? (
            <RegisterPaymentForm
              organizationSlug={slug}
              customerId={customerId}
              services={services}
              plans={planOptions}
              currency={organization.currency}
              livePayments={payments
                .filter((p) => p.status !== "VOID")
                .map((p) => ({ serviceId: p.serviceId, periodStart: p.periodStart, periodEnd: p.periodEnd }))}
            />
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Créditos de recupero</h2>
        <MakeupCreditsPanel
          organizationSlug={slug}
          customerId={customerId}
          services={services.filter((s) => s.isActive)}
          credits={makeupCredits}
          canGrant={membership.role === "OWNER"}
        />
      </section>
    </div>
  );
}
