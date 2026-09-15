import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/return-to";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const destination = safeReturnTo(returnTo);

  if (user) {
    redirect(destination);
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Creá tu cuenta</CardTitle>
          <CardDescription>Empezá a gestionar reservas con Reservaste</CardDescription>
        </CardHeader>
        <CardContent>
          <SignupForm returnTo={destination} />
        </CardContent>
      </Card>
    </div>
  );
}
