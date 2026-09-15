import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

const NAV = [
  { href: "/me", label: "Mis reservas" },
  { href: "/me/servicios", label: "Mis servicios" },
  { href: "/me/pagos", label: "Mis pagos" },
];

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
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 px-4 py-3">
          <Link href="/me" className="text-sm font-semibold">
            Reservaste
          </Link>
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="xs">
              Salir
            </Button>
          </form>
        </div>
        <nav className="mx-auto w-full max-w-lg overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1 text-sm">
            {NAV.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-block whitespace-nowrap rounded-md px-3 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
