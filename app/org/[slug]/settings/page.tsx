import { requireOrganizationMembership } from "@/app/actions/organizations";
import { SettingsForm } from "./settings-form";

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <h1 className="text-xl font-semibold">Configuración</h1>
      <p className="text-sm text-muted-foreground">
        Página pública: <span className="font-mono">/{organization.slug}</span>
      </p>
      <SettingsForm
        organizationSlug={slug}
        organization={organization}
        canEdit={membership.role === "OWNER"}
      />
    </div>
  );
}
