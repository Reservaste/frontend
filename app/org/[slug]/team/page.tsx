import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getTeam, revokeMember } from "@/app/actions/admin";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";

export const metadata = { title: "Equipo" };

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership } = await requireOrganizationMembership(slug);
  const team = await getTeam(slug);
  const isOwner = membership.role === "OWNER";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader title="Equipo" description="Quién puede administrar este negocio" />

      {isOwner ? (
        <InviteForm organizationSlug={slug} />
      ) : (
        <p className="rounded-xl border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Solo un OWNER puede modificar el equipo.
        </p>
      )}

      <ul className="flex flex-col divide-y overflow-hidden rounded-xl border bg-card shadow-card">
        {team.map((member) => (
          <li key={member.memberId} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
              {member.fullName
                .split(" ")
                .slice(0, 2)
                .map((w) => w[0])
                .join("")
                .toUpperCase()}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{member.fullName}</span>
            <StatusBadge tone={member.role === "OWNER" ? "primary" : "neutral"}>{member.role}</StatusBadge>
            {!member.isActive ? <StatusBadge tone="danger">Sin acceso</StatusBadge> : null}
            {isOwner && member.isActive ? (
              <form action={revokeMember.bind(null, slug, member.memberId)}>
                <Button type="submit" variant="ghost" size="xs">
                  Quitar
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
