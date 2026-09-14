import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizations } from "@/app/actions/organizations";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { OnboardingForm } from "./onboarding-form";

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
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Creá tu organización</CardTitle>
          <CardDescription>
            Vas a ser el OWNER de este negocio. Podés invitar STAFF después.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
