"use client";

import * as React from "react";
import { Toast as ToastPrimitive } from "@base-ui/react/toast";
import { cn } from "cn";

/**
 * Toasts, on Base UI's Toast (already a dependency — no toast library).
 *
 * ## What a toast is for
 *
 * Confirming something the user can't see for themselves: an invitation
 * sent, a reminder queued, a link copied. If the result is visible on screen
 * — the row disappeared, the badge turned green — the screen already said
 * it, and a toast on top of that is noise.
 *
 * A toast is never the only place an error appears. It disappears on its own,
 * and something that has to be read and acted on can't. Form errors go in
 * `FormError`, page-level problems in `Alert`.
 *
 * ## Mounted once, in the root layout
 *
 * `<Toaster>` wraps the app in `app/layout.tsx`. It's a client component
 * receiving server-rendered children, which doesn't make those children
 * client components — but it does mean the provider is above everything, so
 * any client component can call `useToast()` without extra wiring.
 *
 * ## Use
 *
 *   "use client";
 *   const toast = useToast();
 *
 *   toast.add({ title: "Invitación enviada", type: "success" });
 *   toast.add({
 *     title: "No se pudo cancelar",
 *     description: "Volvé a intentar en un momento.",
 *     type: "error",
 *     timeout: 0,
 *     priority: "high",
 *   });
 *
 * `type` drives the colour: `success` | `error` | `warning` | anything else
 * (neutral). For a failure, add `timeout: 0` and `priority: "high"` so it
 * waits to be dismissed and is announced at once — a message about something
 * that went wrong shouldn't evaporate while it's being read.
 */

const TONES: Record<string, string> = {
  success: "border-success/30 bg-success-subtle text-success",
  error: "border-destructive/30 bg-destructive-subtle text-destructive",
  warning: "border-warning/40 bg-warning-subtle text-warning-foreground",
};

/** Re-exported so callers never import from `@base-ui/react` directly. */
export const useToast = ToastPrimitive.useToastManager;

/**
 * A manager usable outside React (a `lib/` helper, an event handler in a
 * module that has no hooks). Same methods as `useToast()`.
 */
export const toastManager = ToastPrimitive.createToastManager();

function ToastList() {
  const { toasts } = useToast();

  return (
    <ToastPrimitive.Portal>
      <ToastPrimitive.Viewport
        className={cn(
          // Bottom on a phone, where it can't cover the header, and away
          // from the top edge where the tab strip lives. z-index sits above
          // dialogs and sheets on purpose: a toast fired from inside a sheet
          // that renders behind it is a toast nobody sees.
          "fixed inset-x-4 bottom-4 z-[60] flex flex-col gap-2 outline-none",
          "sm:inset-x-auto sm:end-4 sm:w-[22rem]",
        )}
      >
        {toasts.map((toast) => (
          <ToastPrimitive.Root
            key={toast.id}
            toast={toast}
            className={cn(
              "flex items-start gap-3 rounded-xl border bg-card p-3 text-sm shadow-overlay transition-all duration-200",
              "data-starting-style:translate-y-2 data-starting-style:opacity-0",
              "data-ending-style:opacity-0 data-swiping:duration-0",
              toast.type ? TONES[toast.type] : undefined,
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <ToastPrimitive.Title className="text-sm font-medium" />
              <ToastPrimitive.Description className="text-sm opacity-80" />
            </div>
            <ToastPrimitive.Close
              aria-label="Cerrar"
              className="focus-ring -m-1 flex size-11 shrink-0 items-center justify-center rounded-lg opacity-60 transition-opacity hover:opacity-100 sm:size-8"
            >
              <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
      </ToastPrimitive.Viewport>
    </ToastPrimitive.Portal>
  );
}

/** Mount once, in the root layout, around the whole app. */
export function Toaster({ children }: { children?: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider toastManager={toastManager} limit={3}>
      {children}
      <ToastList />
    </ToastPrimitive.Provider>
  );
}
