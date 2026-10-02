"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  confirmDynamicBooking,
  holdDynamicSlot,
  releaseDynamicHold,
} from "@/app/actions/dynamic-booking";
import type { BookingActionState } from "@/app/actions/customer";
import { Button, buttonVariants } from "@/components/ui/button";
import { FormError } from "@/components/ui/form";
import { Alert } from "@/components/ui/alert";
import { ClockIcon } from "@/components/icons";

const INITIAL_STATE: BookingActionState = { error: null };

/** "4:32" from a duration in ms -- no se busca precisión al segundo. */
function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * ADR-0051: dos fases con estado local, no una sola máquina de
 * `useActionState` -- la fase "confirmar" necesita guardar el resultado
 * del hold (`slotOccurrenceId`/`heldUntil`) para usarlo después, algo que
 * una sola invocación de acción no puede hacer por sí misma.
 */
export function ConfirmDynamicForm({
  organizationSlug,
  serviceId,
  resourceId,
  startAtIso,
  returnTo,
}: {
  organizationSlug: string;
  serviceId: string;
  resourceId: string;
  startAtIso: string;
  returnTo: string;
}) {
  const router = useRouter();
  const [hold, setHold] = useState<{ slotOccurrenceId: string; heldUntil: string } | null>(null);
  const [holdError, setHoldError] = useState<string | null>(null);
  const [isHolding, startHold] = useTransition();

  const chooseAnotherHref = `/${organizationSlug}/reservar-dinamico/${serviceId}`;

  function requestHold() {
    setHoldError(null);
    startHold(async () => {
      const result = await holdDynamicSlot(organizationSlug, resourceId, serviceId, startAtIso, returnTo);
      if (result.error) {
        setHoldError(result.error);
        return;
      }
      if (result.slotOccurrenceId && result.heldUntil) {
        setHold({ slotOccurrenceId: result.slotOccurrenceId, heldUntil: result.heldUntil });
      }
    });
  }

  async function handleReleaseAndPickAnother() {
    if (hold) {
      // No-op silencioso del lado del backend si ya venció o no es propio
      // -- no hace falta esperar un resultado particular para seguir.
      await releaseDynamicHold(hold.slotOccurrenceId);
    }
    router.push(chooseAnotherHref);
  }

  if (!hold) {
    return (
      <div className="flex flex-col gap-3">
        <FormError>{holdError}</FormError>
        <Button size="touch" className="w-full" disabled={isHolding} onClick={requestHold}>
          {isHolding ? "Reservando…" : "Reservar este horario"}
        </Button>
        <Link
          href={chooseAnotherHref}
          className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Elegir otro horario
        </Link>
      </div>
    );
  }

  return (
    <ConfirmPhase
      slotOccurrenceId={hold.slotOccurrenceId}
      heldUntil={hold.heldUntil}
      organizationSlug={organizationSlug}
      chooseAnotherHref={chooseAnotherHref}
      onReleaseAndPickAnother={handleReleaseAndPickAnother}
    />
  );
}

function ConfirmPhase({
  slotOccurrenceId,
  heldUntil,
  organizationSlug,
  chooseAnotherHref,
  onReleaseAndPickAnother,
}: {
  slotOccurrenceId: string;
  heldUntil: string;
  organizationSlug: string;
  chooseAnotherHref: string;
  onReleaseAndPickAnother: () => void;
}) {
  const [state, formAction, pending] = useActionState(
    confirmDynamicBooking.bind(null, slotOccurrenceId, organizationSlug),
    INITIAL_STATE,
  );
  const heldUntilMs = new Date(heldUntil).getTime();
  const [remainingMs, setRemainingMs] = useState(() => heldUntilMs - Date.now());

  // No se busca precisión al segundo -- un tick por segundo alcanza para
  // que la cuenta regresiva se sienta viva sin reconsultar al servidor.
  useEffect(() => {
    const interval = setInterval(() => {
      setRemainingMs(heldUntilMs - Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [heldUntilMs]);

  const expired = remainingMs <= 0;

  return (
    <div className="flex flex-col gap-3">
      {expired ? (
        <Alert tone="warning" icon={<ClockIcon />}>
          Tu selección venció.
        </Alert>
      ) : (
        <Alert tone="info" icon={<ClockIcon />}>
          Tenés <span className="tnum font-medium">{formatCountdown(remainingMs)}</span> para confirmar.
        </Alert>
      )}

      {expired ? (
        <Link href={chooseAnotherHref} className={buttonVariants({ size: "touch", className: "w-full" })}>
          Elegir un horario
        </Link>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <FormError>{state.error}</FormError>
          <Button type="submit" size="touch" disabled={pending} className="w-full">
            {pending ? "Confirmando…" : "Confirmar reserva"}
          </Button>
        </form>
      )}

      {!expired ? (
        <button
          type="button"
          onClick={onReleaseAndPickAnother}
          className="text-center text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Elegir otro horario
        </button>
      ) : null}
    </div>
  );
}
