import { redirect } from "next/navigation";
import { readTeamInvitationToken } from "@/lib/server-cookies";
import { createClient } from "@/lib/supabase/server";
import { safeReturnTo } from "@/lib/return-to";
import { Brand } from "@/components/brand";
import { Alert } from "@/components/ui/alert";
import { ConfirmTeamInvitationForm } from "./confirm-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sumarte al equipo", robots: { index: false, follow: false } };

/**
 * ADR-0034: confirmation screen for a team invitation.
 *
 * Never redeems on its own, even with a session already open (ADR-0015's
 * confused-deputy principle, same as `/activar/continuar`): joining a team
 * gives access to other people's data, so it takes an explicit tap.
 *
 * What this page must NOT say (docs/security.md, Fase 33): the email or the
 * name the invitation was issued to. The email is the second factor -- a
 * link that reached a mistyped number must not tell its reader which
 * mailbox to sign up with. The only email shown is the one of the current
 * session, which the person already knows.
 */
export default async function TeamInvitationContinuePage() {
  const token = await readTeamInvitationToken();

  if (!token) {
    return (
      <Shell>
        <Alert tone="warning" title="No encontramos la invitación en este navegador">
          Volvé a abrir el link desde este mismo teléfono y seguí desde ahí.
        </Alert>
      </Shell>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?returnTo=${encodeURIComponent(safeReturnTo("/equipo/continuar"))}`);
  }

  return (
    <Shell>
      <p className="text-sm text-muted-foreground">
        Vas a aceptar la invitación con la cuenta <strong className="text-foreground">{user.email}</strong>.
        Tiene que ser el mismo email al que te invitaron.
      </p>
      <ConfirmTeamInvitationForm />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 px-5 py-10">
      <Brand />
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border bg-card p-6 shadow-raised sm:p-7">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">Sumarte al equipo</h1>
          <p className="text-sm text-muted-foreground">
            Un negocio te invitó a su equipo en Reservaste. Al aceptar, vas a poder entrar a su panel.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
