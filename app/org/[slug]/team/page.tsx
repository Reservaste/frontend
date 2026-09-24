import Link from "next/link";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getTeam, revokeMember } from "@/app/actions/admin";
import { getOrganizationRoles } from "@/app/actions/roles";
import { getTeamInvitations } from "@/app/actions/team-invitations";
import { getPlanUsage } from "@/app/actions/platform";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status";
import { roleLabel } from "@/lib/labels";
import { rolePermissionSummary } from "@/lib/role-labels";
import { nowMs } from "@/lib/calendar";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DataList, DataListRow } from "@/components/ui/table";
import { InviteForm } from "./invite-form";
import { TeamInvitationForm } from "./team-invitation-form";
import { InvitationList } from "./invitation-list";
import { MemberRoleSelect } from "./member-role-select";
import { RoleForm } from "./role-form";
import { RoleActions } from "./role-actions";

export const metadata = { title: "Equipo" };

/**
 * Equipo: who is on the team, what each role can do (ADR-0033), and who was
 * invited but has not joined yet (ADR-0034). Roles live on this same screen
 * on purpose (docs/api.md, Fase 32): "what can this person do?" and "what
 * can this role do?" are answered together.
 *
 * Everything that writes is OWNER-only in the database; this page only
 * avoids offering it to anyone else.
 */
export default async function TeamPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ historial?: string }>;
}) {
  const { slug } = await params;
  const { historial } = await searchParams;
  const showHistory = historial === "1";

  const { organization, membership } = await requireOrganizationMembership(slug);
  const isOwner = membership.role === "OWNER";

  const [team, roles, invitations, usage] = await Promise.all([
    getTeam(slug),
    getOrganizationRoles(slug),
    isOwner ? getTeamInvitations(slug, showHistory) : Promise.resolve([]),
    isOwner ? getPlanUsage(slug) : Promise.resolve(null),
  ]);

  const activeRoles = roles.filter((r) => r.isActive);
  const activeMembers = team.filter((m) => m.isActive);

  // Seats, counted the way the database counts them when issuing: active
  // members + live invitations (expired ones do not hold a seat). Said up
  // front instead of letting PLAN_LIMIT_REACHED appear on submit -- the
  // most confusing error of this feature otherwise.
  const pendingInvitations = (invitations ?? []).filter((i) => i.status === "PENDING").length;
  const seatLimit = usage?.teamLimit ?? null;
  const seatsTaken = activeMembers.length + pendingInvitations;
  const planFull = seatLimit !== null && seatsTaken >= seatLimit;

  const now = nowMs();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-6">
      <PageHeader title="Equipo" description="Quién puede entrar al panel de este negocio y qué puede hacer" />

      {isOwner ? (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <TeamInvitationForm organizationSlug={slug} roles={activeRoles} disabled={planFull} />
            <InviteForm organizationSlug={slug} roles={activeRoles} disabled={planFull} />
          </div>
          {seatLimit !== null ? (
            planFull ? (
              <Alert tone="warning" title="Tu plan no tiene más lugares de equipo">
                {seatsTaken} de {seatLimit} lugares ocupados
                {pendingInvitations > 0
                  ? `, contando ${pendingInvitations} ${pendingInvitations === 1 ? "invitación pendiente" : "invitaciones pendientes"}. Revocá una o cambiá de plan para sumar a alguien más.`
                  : ". Cambiá de plan para sumar a alguien más."}
              </Alert>
            ) : (
              <p className="text-xs text-muted-foreground">
                <span className="tnum">
                  {seatsTaken} de {seatLimit}
                </span>{" "}
                lugares de equipo ocupados
                {pendingInvitations > 0 ? ` (incluye ${pendingInvitations} pendiente${pendingInvitations === 1 ? "" : "s"})` : ""}.
              </p>
            )
          ) : null}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Solo el dueño puede sumar gente al equipo y cambiar roles.
        </p>
      )}

      {isOwner ? (
        <section className="flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Invitaciones</h2>
            <Link
              href={showHistory ? `/org/${slug}/team` : `/org/${slug}/team?historial=1`}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              scroll={false}
            >
              {showHistory ? "Ocultar historial" : "Ver historial"}
            </Link>
          </div>
          {invitations === null ? (
            <Alert tone="danger" title="No se pudieron cargar las invitaciones">
              Recargá la página en un momento.
            </Alert>
          ) : invitations.length === 0 ? (
            <EmptyState
              size="sm"
              title={
                showHistory
                  ? "Todavía no invitaste a nadie que no tenga cuenta."
                  : "No hay invitaciones pendientes."
              }
              description={
                showHistory
                  ? undefined
                  : "Con “Invitar al equipo” le mandás un link por WhatsApp a alguien que todavía no tiene cuenta."
              }
            />
          ) : (
            <InvitationList
              organizationSlug={slug}
              invitations={invitations}
              timezone={organization.timezone}
              now={now}
            />
          )}
        </section>
      ) : null}

      <section className="flex flex-col gap-2.5">
        <h2 className="text-sm font-semibold">Personas</h2>
        {team.length === 0 ? (
          <EmptyState size="sm" title="No se pudo cargar el equipo." description="Recargá la página en un momento." />
        ) : (
          <DataList>
            {team.map((member) => (
              <DataListRow key={member.memberId} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                    {member.fullName
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase()}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{member.fullName}</span>
                    {member.role === "OWNER" ? (
                      <span className="text-xs text-muted-foreground">El dueño siempre puede todo</span>
                    ) : member.roleName ? (
                      <span className="text-xs text-muted-foreground">{member.roleName}</span>
                    ) : null}
                  </div>
                  <StatusBadge tone={member.role === "OWNER" ? "primary" : "neutral"}>
                    {member.role === "OWNER" ? roleLabel(member.role) : (member.roleName ?? roleLabel(member.role))}
                  </StatusBadge>
                  {!member.isActive ? <StatusBadge tone="danger">Sin acceso</StatusBadge> : null}
                </div>

                {isOwner && member.isActive ? (
                  <div className="flex flex-wrap items-start gap-2 ps-12">
                    {member.role === "STAFF" && activeRoles.length > 0 ? (
                      <MemberRoleSelect
                        organizationSlug={slug}
                        memberId={member.memberId}
                        memberName={member.fullName}
                        currentRoleId={member.roleId}
                        roles={activeRoles}
                      />
                    ) : null}
                    <ConfirmDialog
                      trigger={
                        <Button variant="ghost" size="touch">
                          Quitar
                        </Button>
                      }
                      title={`¿Quitar a ${member.fullName} del equipo?`}
                      description="Deja de poder entrar al panel de este negocio."
                    >
                      <form action={revokeMember.bind(null, slug, member.memberId)}>
                        <Button type="submit" variant="destructive" size="touch" className="w-full">
                          Sí, quitar
                        </Button>
                      </form>
                    </ConfirmDialog>
                  </div>
                ) : null}
              </DataListRow>
            ))}
          </DataList>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-sm font-semibold">Roles</h2>
            <p className="text-xs text-muted-foreground">
              Qué puede hacer cada persona del equipo. El dueño no lleva rol: siempre puede todo.
            </p>
          </div>
          {isOwner ? (
            <RoleForm
              organizationSlug={slug}
              trigger={
                <Button variant="outline" size="touch">
                  + Nuevo rol
                </Button>
              }
            />
          ) : null}
        </div>

        {activeRoles.length === 0 ? (
          <EmptyState
            size="sm"
            title="No se pudieron cargar los roles."
            description="Recargá la página en un momento."
          />
        ) : (
          <DataList>
            {activeRoles.map((role) => {
              const memberCount = activeMembers.filter(
                (m) => m.role === "STAFF" && m.roleId === role.id,
              ).length;
              return (
                <DataListRow key={role.id} className="flex flex-col gap-2.5 px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.isDefault ? <StatusBadge tone="primary">Por defecto</StatusBadge> : null}
                      </div>
                      <span className="text-xs text-muted-foreground">{rolePermissionSummary(role)}</span>
                    </div>
                    <span className="tnum shrink-0 text-xs text-muted-foreground">
                      {memberCount === 1 ? "1 persona" : `${memberCount} personas`}
                    </span>
                  </div>
                  {isOwner ? (
                    <RoleActions organizationSlug={slug} role={role} memberCount={memberCount} />
                  ) : null}
                </DataListRow>
              );
            })}
          </DataList>
        )}
        {isOwner ? (
          <p className="text-xs text-muted-foreground">
            A quien no le asignes un rol le toca el rol por defecto. Un rol nuevo arranca con todo habilitado.
          </p>
        ) : null}
      </section>
    </div>
  );
}
