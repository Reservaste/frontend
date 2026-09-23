import { requireOrganizationMembership } from "@/app/actions/organizations";
import { PageHeader } from "@/components/page-header";
import { getPlanUsage } from "@/app/actions/platform";
import { PlanUsageCard } from "@/components/plan-usage";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm, type MakeupCreditSettings } from "./settings-form";
import { BrandingForm } from "./branding-form";

export const metadata = { title: "Configuración" };

export default async function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization, membership } = await requireOrganizationMembership(slug);
  const usage = await getPlanUsage(slug);

  // ADR-0025 resolución 3: la política de crédito de recupero vive en
  // `organizations`, pero no está en el shape que `mapOrganization()`
  // devuelve (`@reservaste/domain`), así que se lee acá para prellenar el
  // formulario -- mismo criterio que `customers.phone` en la ficha de
  // cliente. Es una lectura, no una regla: quién emite un crédito y cuándo
  // vence lo sigue decidiendo `issue_makeup_credit()`.
  const supabase = await createClient();
  const { data: makeupRow } = await supabase
    .from("organizations")
    .select("makeup_credits_enabled, release_deadline_hours, makeup_credit_expiry, makeup_credit_expiry_days")
    .eq("id", organization.id)
    .maybeSingle();

  const makeup: MakeupCreditSettings = {
    // Los defaults son los de ADR-0025 (opt-in apagado, 12 h,
    // END_OF_MONTH): si la fila no se pudo leer, el formulario no inventa
    // una política distinta de la que la base aplica.
    enabled: makeupRow?.makeup_credits_enabled ?? false,
    releaseDeadlineHours: makeupRow?.release_deadline_hours ?? 12,
    expiry: (makeupRow?.makeup_credit_expiry as MakeupCreditSettings["expiry"]) ?? "END_OF_MONTH",
    expiryDays: makeupRow?.makeup_credit_expiry_days ?? null,
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Configuración"
        description={`Tu página pública es reservaste.app/${organization.slug}`}
      />
      {usage ? <PlanUsageCard usage={usage} /> : null}

      <BrandingForm
        organizationSlug={slug}
        organization={organization}
        canEdit={membership.role === "OWNER"}
      />

      <SettingsForm
        organizationSlug={slug}
        organization={organization}
        makeup={makeup}
        canEdit={membership.role === "OWNER"}
      />
    </div>
  );
}
