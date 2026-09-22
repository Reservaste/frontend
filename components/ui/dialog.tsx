"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type {
  DialogCloseProps,
  DialogDescriptionProps,
  DialogPopupProps,
  DialogRootProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "@base-ui/react/dialog";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * Modal dialog, on Base UI's Dialog (already a dependency — no new one).
 *
 * Base UI gives us the parts that are wrong in every hand-rolled modal:
 * focus trap, focus restore to the trigger, `Escape`, scroll lock, and the
 * `aria-labelledby`/`aria-describedby` wiring between the popup and its
 * title and description. **Always render a `DialogTitle`** — without one the
 * dialog has no accessible name and a screen reader announces "dialog" and
 * nothing else.
 *
 * On a phone, prefer `Sheet`: a centered box with a page dimmed behind it is
 * a desktop idiom, and a sheet puts its actions where the thumb already is.
 * Use `Dialog` for confirmations and for short admin forms on desktop.
 *
 * ## Usable from a Server Component
 *
 * The parts are client components, but everything a caller passes in is a
 * plain element, so a Server Component can render a whole dialog as long as
 * it doesn't pass a function. That means the confirm control is a
 * `<form action={serverAction}>` and not an `onClick` (ADR-0023: what crosses
 * the boundary is flat serializable data — a server action reference is).
 *
 *   <Dialog>
 *     <DialogTrigger render={<Button variant="outline" />}>Editar</DialogTrigger>
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Editar servicio</DialogTitle>
 *         <DialogDescription>Cambia cómo lo ven tus clientes.</DialogDescription>
 *       </DialogHeader>
 *       <form action={updateService} className="flex flex-col gap-3">
 *         …
 *         <DialogFooter>
 *           <DialogClose render={<Button variant="ghost" />}>Cancelar</DialogClose>
 *           <Button type="submit">Guardar</Button>
 *         </DialogFooter>
 *       </form>
 *     </DialogContent>
 *   </Dialog>
 *
 * ## Closing after a server action
 *
 * An uncontrolled dialog does not close by itself when its action succeeds.
 * If the action makes the dialog's own trigger disappear (a row that gets
 * archived), that resolves itself. If the screen stays, drive `open` from the
 * caller with `useActionState` and close it when the action reports success —
 * don't wrap the submit button in `DialogClose` hoping both happen, because
 * unmounting the form during the click is a race.
 */
export function Dialog(props: DialogRootProps) {
  return <DialogPrimitive.Root {...props} />;
}

/**
 * The control that opens the dialog. Compose it with our Button instead of
 * styling it from scratch: `render={<Button variant="outline" />}`.
 */
export function DialogTrigger({
  className,
  ...props
}: Omit<DialogTriggerProps, "className"> & { className?: string }) {
  return <DialogPrimitive.Trigger className={cn(className)} {...props} />;
}

const SIZES = {
  sm: "sm:max-w-sm",
  default: "sm:max-w-md",
  lg: "sm:max-w-lg",
} as const;

/**
 * Portal + backdrop + popup in one, because there is no case in this product
 * where we want one without the others.
 *
 * Centering is done with `inset-0 m-auto h-fit` rather than a
 * translate-based centre, so the enter/exit transition is free to use
 * `scale`/`translate` without fighting the positioning.
 */
export function DialogContent({
  className,
  size = "default",
  showClose = true,
  closeLabel = "Cerrar",
  children,
  ...props
}: Omit<DialogPopupProps, "className" | "children"> & {
  className?: string;
  size?: keyof typeof SIZES;
  showClose?: boolean;
  closeLabel?: string;
  children?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-foreground/25 transition-opacity duration-200",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
        )}
      />
      <DialogPrimitive.Popup
        className={cn(
          "fixed inset-0 z-50 m-auto flex h-fit max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] flex-col gap-4 overflow-y-auto rounded-xl bg-card p-5 text-sm text-card-foreground shadow-overlay outline-none",
          "transition duration-200 data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0",
          SIZES[size],
          className,
        )}
        {...props}
      >
        {children}
        {showClose ? (
          <DialogPrimitive.Close
            aria-label={closeLabel}
            className="focus-ring absolute end-2 top-2 flex size-11 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:size-8"
          >
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </DialogPrimitive.Close>
        ) : null}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

/** Title + description block. Leaves room on the end for the close button. */
export function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 pe-10", className)}
      {...props}
    />
  );
}

export function DialogTitle({
  className,
  ...props
}: Omit<DialogTitleProps, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Title
      className={cn("font-heading text-base leading-snug font-semibold", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: Omit<DialogDescriptionProps, "className"> & { className?: string }) {
  return (
    <DialogPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * Action row. Stacked and full-width on a phone, right-aligned from `sm` up.
 *
 * `flex-col-reverse` means the primary action goes *last* in the markup and
 * ends up on top on mobile, where the thumb is — while keyboard order still
 * reads cancel-then-confirm.
 */
export function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
      {...props}
    />
  );
}

export function DialogClose({
  className,
  ...props
}: Omit<DialogCloseProps, "className"> & { className?: string }) {
  return <DialogPrimitive.Close className={cn(className)} {...props} />;
}

/**
 * The destructive-confirmation preset, so "¿seguro?" looks and reads the
 * same everywhere instead of being `window.confirm` on one screen and a
 * custom modal on the next.
 *
 * `children` is the confirm control — usually a form, so this works from a
 * Server Component:
 *
 *   <ConfirmDialog
 *     trigger={<Button variant="destructive" size="sm">Archivar</Button>}
 *     title="¿Archivar «Pilates»?"
 *     description="Deja de publicarse y no se puede reservar más. Las reservas ya hechas se conservan."
 *   >
 *     <form action={archiveService}>
 *       <Button type="submit" variant="destructive" className="w-full sm:w-auto">
 *         Sí, archivar
 *       </Button>
 *     </form>
 *   </ConfirmDialog>
 *
 * Write the title as the question and the confirm button as the answer
 * ("Sí, archivar"), never "OK": a button that repeats the verb is the
 * difference between reading the dialog and dismissing it.
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  cancelLabel = "Cancelar",
  children,
  ...rootProps
}: DialogRootProps & {
  trigger: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  cancelLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <Dialog {...rootProps}>
      <DialogPrimitive.Trigger render={trigger} />
      <DialogContent size="sm" showClose={false}>
        <DialogHeader className="pe-0">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button variant="ghost" size="touch" />}>
            {cancelLabel}
          </DialogClose>
          {children}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
