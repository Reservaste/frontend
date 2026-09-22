"use client";

import * as React from "react";
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer";
import type {
  DrawerCloseProps,
  DrawerDescriptionProps,
  DrawerPopupProps,
  DrawerRootProps,
  DrawerTitleProps,
  DrawerTriggerProps,
} from "@base-ui/react/drawer";
import { cn } from "cn";
import { Button } from "@/components/ui/button";

/**
 * Sheet — the mobile form of a dialog, on Base UI's Drawer (already a
 * dependency).
 *
 * This is the default for anything interactive on a customer- or
 * public-facing screen: it enters from the edge the thumb is nearest, it can
 * be swiped away, and it keeps its actions at the bottom of the screen
 * instead of in the middle of it. Base UI handles swipe-to-dismiss, the
 * focus trap, scroll lock, `Escape`, and the on-screen keyboard pushing the
 * content up.
 *
 *   <Sheet>
 *     <SheetTrigger render={<Button size="touch" />}>Reservar</SheetTrigger>
 *     <SheetContent>
 *       <SheetHeader>
 *         <SheetTitle>Martes 18:00 · Pilates</SheetTitle>
 *         <SheetDescription>Quedan 2 lugares.</SheetDescription>
 *       </SheetHeader>
 *       <SheetBody>…</SheetBody>
 *       <SheetFooter>
 *         <SheetClose render={<Button variant="ghost" size="touch" />}>Volver</SheetClose>
 *         <form action={bookSlot}>
 *           <Button type="submit" size="touch" className="w-full">Confirmar</Button>
 *         </form>
 *       </SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 *
 * Same two rules as `Dialog`: always render a `SheetTitle` (it's the
 * accessible name), and nothing that crosses a Server Component boundary can
 * be a function — the confirm action is a `<form action={serverAction}>`.
 *
 * `side="end"` gives a right-edge panel for desktop-only admin screens. On a
 * 390px phone both sides render nearly full-width anyway, which is why
 * `bottom` is the default: the swipe direction is the part that matters.
 */
type SheetSide = "bottom" | "end";

const SheetSideContext = React.createContext<SheetSide>("bottom");

export function Sheet({
  side = "bottom",
  ...props
}: DrawerRootProps & { side?: SheetSide }) {
  return (
    <SheetSideContext.Provider value={side}>
      <DrawerPrimitive.Root swipeDirection={side === "bottom" ? "down" : "right"} {...props} />
    </SheetSideContext.Provider>
  );
}

export function SheetTrigger({
  className,
  ...props
}: Omit<DrawerTriggerProps, "className"> & { className?: string }) {
  return <DrawerPrimitive.Trigger className={cn(className)} {...props} />;
}

export function SheetContent({
  className,
  showHandle,
  children,
  ...props
}: Omit<DrawerPopupProps, "className" | "children"> & {
  className?: string;
  /** The grab bar. Shown on bottom sheets by default; it hints at the swipe. */
  showHandle?: boolean;
  children?: React.ReactNode;
}) {
  const side = React.useContext(SheetSideContext);
  const handle = showHandle ?? side === "bottom";

  return (
    <DrawerPrimitive.Portal>
      <DrawerPrimitive.Backdrop
        className={cn(
          "fixed inset-0 z-50 bg-foreground/25 transition-opacity duration-300",
          "data-starting-style:opacity-0 data-ending-style:opacity-0",
        )}
      />
      <DrawerPrimitive.Popup
        className={cn(
          "fixed z-50 flex flex-col gap-4 bg-card text-sm text-card-foreground shadow-overlay outline-none",
          // The transition is on `translate`, which Tailwind sets as its own
          // property -- Base UI writes an inline `transform` while the finger
          // is down, so the two don't overwrite each other.
          "transition duration-300 ease-out data-swiping:duration-0",
          side === "bottom"
            ? [
                "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-2xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]",
                "data-closed:translate-y-full",
              ]
            : [
                "inset-y-0 end-0 w-[min(26rem,100%)] rounded-s-2xl p-5",
                "data-closed:translate-x-full",
              ],
          className,
        )}
        {...props}
      >
        {handle ? (
          <div
            aria-hidden
            className="mx-auto h-1 w-10 shrink-0 rounded-full bg-muted-foreground/25"
          />
        ) : null}
        {children}
      </DrawerPrimitive.Popup>
    </DrawerPrimitive.Portal>
  );
}

export function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex shrink-0 flex-col gap-1", className)}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: Omit<DrawerTitleProps, "className"> & { className?: string }) {
  return (
    <DrawerPrimitive.Title
      className={cn("font-heading text-base leading-snug font-semibold", className)}
      {...props}
    />
  );
}

export function SheetDescription({
  className,
  ...props
}: Omit<DrawerDescriptionProps, "className"> & { className?: string }) {
  return (
    <DrawerPrimitive.Description
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * The scrollable middle. A sheet that is taller than the screen has to
 * scroll *inside* the body, not push its own footer off the bottom — the
 * footer is where the confirm button is.
 */
export function SheetBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-body"
      className={cn("-mx-1 min-h-0 flex-1 overflow-y-auto overscroll-contain px-1", className)}
      {...props}
    />
  );
}

/**
 * Actions, full-width and stacked on a phone. Like `DialogFooter`, the
 * primary action goes last in the markup so it lands on top, closest to the
 * thumb, while the tab order still reads cancel-then-confirm.
 */
export function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end [&>*]:w-full sm:[&>*]:w-auto",
        className,
      )}
      {...props}
    />
  );
}

export function SheetClose({
  className,
  ...props
}: Omit<DrawerCloseProps, "className"> & { className?: string }) {
  return <DrawerPrimitive.Close className={cn(className)} {...props} />;
}

/**
 * A sheet whose only job is to hold a short form or a confirmation: title,
 * description, body, and a "Cerrar" that is always reachable.
 *
 * Works from a Server Component as long as `trigger` and `children` are
 * plain elements (a `<form action={serverAction}>` is).
 */
export function SimpleSheet({
  trigger,
  title,
  description,
  closeLabel = "Cerrar",
  footer,
  children,
  ...rootProps
}: DrawerRootProps & {
  side?: SheetSide;
  trigger: React.ReactElement;
  title: React.ReactNode;
  description?: React.ReactNode;
  closeLabel?: string;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <Sheet {...rootProps}>
      <DrawerPrimitive.Trigger render={trigger} />
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        {children ? <SheetBody>{children}</SheetBody> : null}
        <SheetFooter>
          <SheetClose render={<Button variant="ghost" size="touch" />}>{closeLabel}</SheetClose>
          {footer}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
