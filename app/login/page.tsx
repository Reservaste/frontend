import { redirect } from "next/navigation";
import { safeReturnTo } from "@/lib/return-to";
import { createClient } from "@/lib/supabase/server";
import { Brand } from "@/components/brand";
import { LoginForm } from "./login-form";

export const metadata = { title: "Ingresar" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
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
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
      <Brand />
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-raised sm:p-7">
        <div className="mb-6 flex flex-col gap-1">
          <h1 className="text-xl">Ingresá a tu cuenta</h1>
          <p className="text-sm text-muted-foreground">Gestioná tu agenda o tus reservas</p>
        </div>
        <LoginForm returnTo={destination} />
      </div>
    </div>
  );
}
