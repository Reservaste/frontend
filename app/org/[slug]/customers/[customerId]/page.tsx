import { notFound } from "next/navigation";
import { hasOrgPermission } from "@reservaste/domain";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import {
  getCustomerActivationStatus,
  getCustomerContact,
  getCustomerMakeupCredits,
  getCustomers,
} from "@/app/actions/admin";
import { getCustomerPayments } from "@/app/actions/billing";
import { listServices } from "@/app/actions/services";
import {
  listOrganizationServicePlans,
  listPaymentPlanOptions,
} from "@/app/actions/service-plans";
import { getCustomerServicePlanQuotas, getCustomerStandingReservations } from "@/app/actions/standing";
import { StatusBadge } from "@/components/status";
import { StandingPendingBadges, StandingPendingNotes } from "@/components/standing-pending";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { EmptyState } from "@/components/ui/empty-state";
import { WEEKDAY_LONG } from "@/lib/calendar";
import { QUOTA_SCOPE_LABEL } from "@/lib/plan-labels";
import { groupStandingReservationsByService, quotaBadgeFor } from "@/lib/standing-quota";
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

  const [customers, contact, services, payments, planOptions, allPlans, makeupCredits, standingReservations, planQuotas] =
    await Promise.all([
      getCustomers(slug),
      // ADR-0050: correo y teléfono, sólo en la ficha (no en el listado).
      getCustomerContact(slug, customerId),
      listServices(slug),
      canViewPayments ? getCustomerPayments(slug, customerId) : Promise.resolve([]),
      // What can be charged today (ADR-0024), and every plan ever offered,
      // so a payment for a plan that was since retired still says what it
      // bought.
      listPaymentPlanOptions(slug),
      listOrganizationServicePlans(slug),
      getCustomerMakeupCredits(slug, customerId),
      // Fase 39: qué tiene agendado semana a semana y cuánto de su cuota
      // ya usó. Informativo para cualquiera que pueda ver esta ficha --
      // gestionar el horario fijo en sí vive en la agenda del servicio,
      // no acá (ver `StandingReservations` en `schedule/`).
      getCustomerStandingReservations(slug, customerId),
      getCustomerServicePlanQuotas(slug, customerId),
    ]);

  const customer = customers.find((c) => c.customerId === customerId);
  if (!customer) {
    notFound();
  }

  // ADR-0026: only a managed customer (no profileId) can have an
  // activation to manage. The phone comes from customer_contact() (ADR-0050).
  let activationPanel: React.ReactNode = null;
  if (customer.profileId === null && canManageCustomers) {
    const activationStatus = await getCustomerActivationStatus(slug, customerId);

    activationPanel = (
      <ActivationPanel
        organizationSlug={slug}
        customerId={customerId}
        phone={contact.phone}
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

  const standingGroups = groupStandingReservationsByService(standingReservations);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Clientes", href: `/org/${slug}/customers` },
          { label: customer.fullName },
        ]}
      />

      <div className="flex items-center gap-3">
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-base font-semibold text-primary-on-subtle">
          {initials}
        </span>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">{customer.fullName}</h1>
          <StatusBadge tone={customer.isActive ? "success" : "neutral"} className="self-start">
            {customer.isActive ? "Activo" : "Inactivo"}
          </StatusBadge>
        </div>
      </div>

      <section className="flex flex-col gap-2" aria-labelledby="customer-contact-heading">
        <h2 id="customer-contact-heading" className="text-sm font-semibold">
          Contacto
        </h2>
        <dl className="flex flex-col gap-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Correo:</dt>
            <dd>
              {contact.email ? (
                <a href={`mailto:${contact.email}`} className="underline underline-offset-2">
                  {contact.email}
                </a>
              ) : (
                <span className="text-muted-foreground">Sin correo</span>
              )}
            </dd>
          </div>
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Teléfono:</dt>
            <dd>
              {contact.phone ? (
                <a href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className="underline underline-offset-2">
                  {contact.phone}
                </a>
              ) : (
                <span className="text-muted-foreground">Sin teléfono</span>
              )}
            </dd>
          </div>
        </dl>
      </section>

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
        <h2 className="text-sm font-semibold">Horarios fijos</h2>
        {standingGroups.length === 0 ? (
          <EmptyState
            size="sm"
            title="Este cliente no tiene horarios fijos."
            description="Los turnos que reserva el mismo día y horario cada semana aparecen acá."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {standingGroups.map((group) => {
              const quota = planQuotas.find((q) => q.serviceId === group.serviceId);
              const badge = quotaBadgeFor(quota);
              const sharedScope =
                quota && quota.weeklyQuota !== null && quota.quotaScope === "SHARED_ACROSS_SERVICES";

              return (
                <li key={group.serviceId} className="flex flex-col gap-2.5 rounded-lg border bg-card p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{group.serviceName}</span>
                    {badge ? <StatusBadge tone={badge.tone}>{badge.label}</StatusBadge> : null}
                  </div>
                  {sharedScope ? (
                    <p className="text-xs text-muted-foreground">
                      {QUOTA_SCOPE_LABEL.SHARED_ACROSS_SERVICES}
                      {quota?.planName ? ` en su plan "${quota.planName}"` : ""}.
                    </p>
                  ) : null}
                  <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-muted/30">
                    {group.reservations.map((reservation) => (
                      <li
                        key={reservation.recurringBookingId}
                        className="flex flex-col gap-1.5 px-3 py-2.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm">
                            {WEEKDAY_LONG[reservation.weekday]} {reservation.localStartTime.slice(0, 5)} ·{" "}
                            {reservation.durationMinutes} min
                          </span>
                          <div className="flex flex-wrap items-center gap-2">
                            <StandingPendingBadges counts={reservation} />
                          </div>
                        </div>
                        <StandingPendingNotes counts={reservation} />
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
