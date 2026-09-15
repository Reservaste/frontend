import { requireOrganizationMembership } from "@/app/actions/organizations";
import { PageHeader } from "@/components/page-header";
import { getPlanUsage } from "@/app/actions/platform";
import { PlanUsageCard } from "@/components/plan-usage";
import { SettingsForm } from "./settings-form";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);
  const usage = await getPlanUsage(slug);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Configuración"
        description={`Tu página pública es reservaste.app/${organization.slug}`}
      />
      {usage ? <PlanUsageCard usage={usage} /> : null}

      <SettingsForm
        organizationSlug={slug}
        organization={organization}
        canEdit={membership.role === "OWNER"}
      />
    </div>
  );
}
