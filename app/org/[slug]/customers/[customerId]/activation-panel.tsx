"use client";

import { useState, useTransition } from "react";
import type { CustomerActivationStatus } from "@/app/actions/admin";
import { getCustomerActivationStatus, issueCustomerActivation, revokeCustomerActivation } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status";
import { FormError } from "@/components/ui/form";

function activationState(activation: CustomerActivationStatus | null): {
  label: string;
  tone: "success" | "warning" | "danger" | "neutral";
} {
  if (!activation) return { label: "Sin enviar", tone: "neutral" };
  if (activation.redeemedAt) return { label: "Activada", tone: "success" };
  if (activation.revokedAt) return { label: "Revocada", tone: "neutral" };
  if (new Date(activation.expiresAt).getTime() <= Date.now()) {
    return { label: "Vencida", tone: "danger" };
  }
  return { label: "Enviada, pendiente", tone: "warning" };
}

/**
 * ADR-0026: emitir/reenviar/revocar el link de activación de un cliente
 * gestionado. El token viajero (256 bits) sólo existe en la respuesta de
 * `issue_customer_activation()` -- se guarda acá en memoria de React
 * exactamente hasta que el dueño lo manda por WhatsApp, y nunca se vuelve
 * a poder leer después.
 */
export function ActivationPanel({
  organizationSlug,
  customerId,
  phone,
  initialStatus,
}: {
  organizationSlug: string;
  customerId: string;
  /** null if the customer has no phone on file -- issuing is blocked upstream too. */
  phone: string | null;
  initialStatus: CustomerActivationStatus | null;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const state = activationState(status);
  const canIssue = !status || state.label === "Vencida" || state.label === "Revocada";

  const issue = () => {
    setError(null);
    startTransition(async () => {
      const result = await issueCustomerActivation(organizationSlug, customerId);
      if (result.error || !result.activation) {
        setError(result.error ?? "No se pudo generar el link");
        return;
      }
      setLink(result.activation.whatsappUrl);
      // Refetched rather than built locally, so `status.activationId` is
      // the real row id -- needed for the Revocar button right after
      // issuing, without waiting for a full page reload.
      const fresh = await getCustomerActivationStatus(organizationSlug, customerId);
      setStatus(fresh);
    });
  };

  const revoke = () => {
    if (!status?.activationId) return;
    setError(null);
    setLink(null);
    startTransition(async () => {
      await revokeCustomerActivation(organizationSlug, customerId, status.activationId);
      setStatus({ ...status, revokedAt: new Date().toISOString() });
    });
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Activación por WhatsApp</h2>
        <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
      </div>

      {!phone ? (
        <p className="text-sm text-muted-foreground">
          Este cliente no tiene teléfono cargado. Agregalo para poder mandarle el link.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {canIssue ? (
              <Button type="button" onClick={issue} disabled={pending}>
                {pending ? "Generando…" : status ? "Reenviar link" : "Enviar link de activación"}
              </Button>
            ) : (
              <>
                <Button type="button" variant="outline" onClick={issue} disabled={pending}>
                  {pending ? "Generando…" : "Reenviar (invalida el anterior)"}
                </Button>
                {status?.activationId ? (
                  <Button type="button" variant="ghost" onClick={revoke} disabled={pending}>
                    Revocar
                  </Button>
                ) : null}
              </>
            )}
          </div>

          {link ? (
            <a
              href={link}
              target="_blank"
              rel="noreferrer noopener"
              className="focus-ring inline-flex w-fit items-center gap-2 rounded-md bg-success px-3 py-2 text-sm font-medium text-success-foreground"
            >
              Abrir WhatsApp con el mensaje listo
            </a>
          ) : null}

          <FormError>{error}</FormError>
        </>
      )}
    </div>
  );
}
