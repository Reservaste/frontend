import { redirect } from "next/navigation";
import { readActivationToken } from "@/app/actions/activation";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/return-to";
import { Brand } from "@/components/brand";
import { Alert } from "@/components/ui/alert";
import { ConfirmActivationForm } from "./confirm-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Activar cuenta", robots: { index: false, follow: false } };

/**
 * ADR-0026 Sec 2.4: never links automatically, even with a session
 * already open (ADR-0015's confused-deputy principle). The token itself
 * never appears in this page's URL -- it travels only in the httpOnly
 * cookie the /activar/[token] route handler set.
 */
export default async function ActivationContinuePage() {
  const token = await readActivationToken();

  if (!token) {
    return (
      <Shell>
        <Alert tone="warning" title="Este link ya no es válido">
          Puede haber vencido o ya haberse usado. Pedile al negocio que te reenvíe la invitación por
          WhatsApp.
        </Alert>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo("/activar/continuar"))}`);
  }

  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Vas a activar esta invitación con la cuenta <strong>{user.email}</strong>.
      </p>
      <ConfirmActivationForm />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
      <Brand />
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-raised sm:p-7">
        <h1 className="text-xl">Activar tu cuenta</h1>
        {children}
      </div>
    </div>
  );
}
