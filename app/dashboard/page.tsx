import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyOrganizations } from "@/app/actions/organizations";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const organizations = await getMyOrganizations();

  if (organizations.length === 0) {
    redirect("/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tus organizaciones</h1>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="sm">
            Cerrar sesión
          </Button>
        </form>
      </div>

      <div className="flex flex-col gap-3">
        {organizations.map(({ organization, membership }) => (
          <Link key={organization.id} href={`/org/${organization.slug}`}>
            <Card className="transition-colors hover:bg-muted">
              <CardHeader>
                <CardTitle>{organization.name}</CardTitle>
                <CardDescription>
                  {organization.slug} · rol: {membership.role} · zona horaria: {organization.timezone}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
