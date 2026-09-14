import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getTeam, revokeMember } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { InviteForm } from "./invite-form";

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { membership } = await requireOrganizationMembership(slug);
  const team = await getTeam(slug);

  const isOwner = membership.role === "OWNER";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Equipo</h1>

      {isOwner ? (
        <InviteForm organizationSlug={slug} />
      ) : (
        <p className="text-sm text-muted-foreground">Solo un OWNER puede modificar el equipo.</p>
      )}

      <ul className="flex flex-col divide-y rounded-lg border">
        {team.map((member) => (
          <li key={member.memberId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="flex flex-col">
              <span className="text-sm">{member.fullName}</span>
              <span className="text-xs text-muted-foreground">
                {member.role}
                {member.isActive ? "" : " · sin acceso"}
              </span>
            </div>
            {isOwner && member.isActive ? (
              <form action={revokeMember.bind(null, slug, member.memberId)}>
                <Button type="submit" variant="ghost" size="xs">
                  Quitar acceso
                </Button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
