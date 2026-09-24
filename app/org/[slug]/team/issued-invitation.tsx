"use client";

import { useState } from "react";
import type { IssuedTeamInvitation } from "@/app/actions/team-invitations";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon } from "@/components/icons";
import { useToast } from "@/components/ui/toast";

/**
 * What the owner sees right after issuing (or re-issuing) a team
 * invitation -- once. The token only exists inside these two URLs, and they
 * only exist in this component's props: it is never rendered as text, never
 * put in a visible input, never logged (docs/api.md, Fase 33).
 */
export function IssuedInvitation({ invitation }: { invitation: IssuedTeamInvitation }) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(invitation.invitationUrl);
      setCopied(true);
      toast.add({ title: "Link copiado", type: "success" });
    } catch {
      toast.add({
        title: "No se pudo copiar el link",
        description: "Tu navegador no dejó usar el portapapeles. Reenviá la invitación desde un navegador que lo permita.",
        type: "error",
        timeout: 0,
        priority: "high",
      });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Alert tone="warning" title="Este link se muestra una sola vez">
        Vence en 24 horas. Si lo perdés, reenviá la invitación: el link anterior deja de funcionar.
      </Alert>
      <div className="flex flex-col gap-2 sm:flex-row">
        {invitation.whatsappUrl ? (
          <a
            href={invitation.whatsappUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-success px-4 text-sm font-medium text-success-foreground shadow-card sm:h-9 sm:px-3"
          >
            Enviar por WhatsApp
          </a>
        ) : null}
        <Button
          type="button"
          variant={invitation.whatsappUrl ? "outline" : "default"}
          size="touch"
          onClick={copy}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copiado" : "Copiar link"}
        </Button>
      </div>
      {!invitation.whatsappUrl ? (
        <p className="text-xs text-muted-foreground">
          Sin teléfono no hay mensaje armado: copiá el link y mandáselo por donde prefieras.
        </p>
      ) : null}
    </div>
  );
}
