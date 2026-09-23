import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/brand";
import { MeNav } from "@/components/me-nav";

export default async function CustomerLayout({ children }: LayoutProps<"/me">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?returnTo=%2Fme");
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="brand-wash border-b border-border/70 bg-card shadow-card">
        {/* max-w-3xl, not max-w-lg: the landing screen is a week calendar
            now and a 32rem column turned it into a horizontal scroll on a
            laptop. The list screens keep their own narrower column. */}
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2 px-5 py-3">
          {/* /dashboard, not /me: it is the one page that leads both to
              the portal and to the organizations you run, and the portal
              is already one tap away in the bar below. */}
          <Brand href="/dashboard" />
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="touch">
              Salir
            </Button>
          </form>
        </div>
        <MeNav />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
