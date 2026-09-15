import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizations } from "@/app/actions/organizations";
import { Brand } from "@/components/brand";
import { OnboardingForm } from "./onboarding-form";

export const metadata = { title: "Crear organización" };

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizations = await getMyOrganizations();
  if (organizations.length > 0) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
      <Brand />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-raised sm:p-7">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl">Creá tu organización</h1>
          <p className="text-sm text-muted-foreground">
            Vas a ser el dueño de este negocio. Podés invitar a tu equipo después.
          </p>
        </div>
        <OnboardingForm />
      </div>
    </div>
  );
}
