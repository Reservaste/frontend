import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Reservaste</h1>
      <p className="max-w-md text-muted-foreground">
        Agenda, reservas y cupos dinámicos para cualquier negocio con horarios.
      </p>
      <div className="flex gap-3">
        <Link href="/signup" className={buttonVariants({ variant: "default" })}>
          Crear cuenta
        </Link>
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Ingresar
        </Link>
      </div>
    </div>
  );
}
