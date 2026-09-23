import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPlatformContactRequests,
  getPlatformInvites,
  getPlatformOrganizations,
  isPlatformAdmin,
} from "@/app/actions/platform";
import { signOut } from "@/app/actions/auth";
import { Brand } from "@/components/brand";
import { StatusBadge } from "@/components/status";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { DataList, DataListRow } from "@/components/ui/table";
import { InviteForm, CopyCodeButton } from "./invite-form";
import { SubscriptionControls } from "./subscription-controls";
import { MarkHandledButton } from "./contact-request-actions";

export const metadata = { title: "Plataforma" };

const PLANS = [
  { code: "starter", name: "Starter", price: 20 },
  { code: "pro", name: "Pro", price: 40 },
  { code: "full", name: "Full", price: 80 },
];

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  ACTIVE: { label: "Al día", tone: "success" },
  TRIALING: { label: "En prueba", tone: "warning" },
  PAST_DUE: { label: "Impago", tone: "danger" },
  SUSPENDED: { label: "Suspendida", tone: "danger" },
};

export default async function PlatformAdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=%2Fadmin");
  }

  // Not a 403 page: someone who isn't a platform admin shouldn't learn
  // this console exists.
  if (!(await isPlatformAdmin())) {
    notFound();
  }

  const [organizations, invites, contactRequests] = await Promise.all([
    getPlatformOrganizations(),
    getPlatformInvites(),
    getPlatformContactRequests(),
  ]);

  const pendingInvites = invites.filter((i) => !i.redeemedAt);
  const pendingContactRequests = contactRequests.filter((c) => !c.handledAt);
  const mrr = organizations
    .filter((o) => o.subscriptionStatus === "ACTIVE")
    .reduce((sum, o) => sum + (PLANS.find((p) => p.code === o.planCode)?.price ?? 0), 0);

  return (
    <div className="flex flex-1 flex-col">
      <header className="brand-wash border-b border-border/70 bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <Brand href="/dashboard" label="Reservaste" />
            <StatusBadge tone="primary">Plataforma</StatusBadge>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="touch">
              Salir
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-5 py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Organizaciones", value: String(organizations.length) },
            {
              label: "Activas",
              value: String(organizations.filter((o) => o.subscriptionStatus === "ACTIVE").length),
            },
            { label: "MRR", value: `${mrr} USD` },
          ].map((stat) => (
            <div key={stat.label} className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3.5 shadow-card">
              <span className="eyebrow text-muted-foreground">{stat.label}</span>
              <span className="tnum text-2xl font-semibold leading-none">{stat.value}</span>
            </div>
          ))}
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Generar código de invitación</h2>
          <InviteForm plans={PLANS} />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Códigos sin usar ({pendingInvites.length})</h2>
          {pendingInvites.length === 0 ? (
            <EmptyState size="sm" title="No hay códigos pendientes." />
          ) : (
            <DataList>
              {pendingInvites.map((invite) => (
                <DataListRow key={invite.code} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-mono text-sm font-semibold tracking-widest">{invite.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {PLANS.find((p) => p.code === invite.planCode)?.name ?? invite.planCode}
                      {invite.trialDays ? ` · ${invite.trialDays} días de prueba` : ""}
                      {invite.email ? ` · sólo ${invite.email}` : ""}
                      {invite.note ? ` · ${invite.note}` : ""}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {invite.expiresAt ? (
                      <span className="text-xs text-muted-foreground">
                        vence {new Date(invite.expiresAt).toLocaleDateString("es-UY")}
                      </span>
                    ) : null}
                    <CopyCodeButton code={invite.code} />
                  </div>
                </DataListRow>
              ))}
            </DataList>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">
            Mensajes de contacto ({pendingContactRequests.length} sin atender)
          </h2>
          {contactRequests.length === 0 ? (
            <EmptyState size="sm" title="Todavía no llegó ningún mensaje del formulario de contacto." />
          ) : (
            <DataList>
              {contactRequests.map((request) => (
                <DataListRow key={request.id} className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{request.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {request.email}
                        {request.phone ? ` · ${request.phone}` : ""}
                        {request.businessType ? ` · ${request.businessType}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString("es-UY")}
                      </span>
                      {request.handledAt ? (
                        <StatusBadge tone="success">Atendido</StatusBadge>
                      ) : (
                        <StatusBadge tone="warning">Sin atender</StatusBadge>
                      )}
                    </div>
                  </div>
                  <p className="break-words text-sm text-foreground">{request.message}</p>
                  {!request.handledAt ? (
                    <div className="flex justify-end">
                      <MarkHandledButton contactRequestId={request.id} />
                    </div>
                  ) : null}
                </DataListRow>
              ))}
            </DataList>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold">Organizaciones</h2>
          {organizations.length === 0 ? (
            <EmptyState
              title="Todavía no hay organizaciones"
              description="Generá un código y pasáselo a tu primer cliente."
            />
          ) : (
            <DataList>
              {organizations.map((org) => {
                const status = STATUS[org.subscriptionStatus] ?? {
                  label: org.subscriptionStatus,
                  tone: "warning" as const,
                };

                return (
                  <DataListRow key={org.organizationId} className="flex flex-col gap-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <Link href={`/${org.slug}`} className="font-medium hover:underline">
                          {org.name}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          /{org.slug} · {org.servicesUsed} servicios · {org.customersUsed} clientes ·{" "}
                          {org.teamUsed} en el equipo
                        </span>
                      </div>
                      <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
                    </div>
                    <SubscriptionControls organization={org} plans={PLANS} />
                  </DataListRow>
                );
              })}
            </DataList>
          )}
        </section>
      </div>
    </div>
  );
}
