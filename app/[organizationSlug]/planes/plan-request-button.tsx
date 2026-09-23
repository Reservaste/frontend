"use client";

import { useActionState } from "react";
import { requestPlanChange } from "@/app/actions/plan-changes";
import type { ActionState } from "@/app/actions/admin";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { StatusBadge } from "@/components/status";

const initialState: ActionState = { error: null, success: null };

/**
 * "Quiero cambiarme a este plan" (ADR-0035).
 *
 * El botón **no cambia el plan**: registra un pedido. El cambio sigue
 * siendo VOID + recargar del mostrador (ADR-0024 resolución 1), así que
 * lo único honesto que puede decir esta pantalla es que el negocio va a
 * contactar para cobrarlo. Un texto que prometa el cambio acá es el bug.
 *
 * `alreadyPending` viene del servidor (`getMyPlanChangeRequests`) y
 * `state.success` del envío de esta misma sesión: la acción revalida
 * `/me`, no esta ruta pública, así que sin el segundo el botón volvería a
 * ofrecerse después de haberlo usado. La RPC es idempotente igual — esto
 * es para no invitar a machacarlo, no para protegerla.
 */
export function PlanRequestButton({
  planId,
  alreadyPending,
}: {
  planId: string;
  alreadyPending: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    requestPlanChange.bind(null, planId),
    initialState,
  );

  const sent = alreadyPending || Boolean(state.success);

  if (sent) {
    return (
      <div className="flex flex-col gap-1">
        <StatusBadge tone="primary" className="self-start">
          Pedido enviado
        </StatusBadge>
        <p className="text-xs text-muted-foreground">
          {state.success ??
            "Ya pediste este plan. El negocio te va a contactar para confirmarlo y cobrarlo."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-1.5">
      <Button type="submit" size="touch" className="w-full sm:w-auto" disabled={pending}>
        {pending ? "Enviando…" : "Quiero cambiarme a este plan"}
      </Button>
      <FormError>{state.error}</FormError>
    </form>
  );
}
