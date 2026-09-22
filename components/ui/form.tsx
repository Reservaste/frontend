import * as React from "react";
import { cn } from "cn";
import { AlertCircleIcon, CheckIcon } from "@/components/icons";

/**
 * Form scaffolding.
 *
 * There is no form library here on purpose: every form in this product is a
 * `<form action={serverAction}>` plus `useActionState`, and validation is
 * server-side because it has to be (CLAUDE.md: the frontend is never the
 * defence). So these components only do two things -- lay a field out, and
 * render the message the action came back with.
 *
 *   const [state, formAction, pending] = useActionState(action, initial);
 *
 *   <form action={formAction} className="flex flex-col gap-3">
 *     <Field>
 *       <Label htmlFor="name">Nombre</Label>
 *       <Input id="name" name="name" required aria-invalid={!!state.error} />
 *       <FieldHint>Como lo ven tus clientes.</FieldHint>
 *     </Field>
 *     <FormError>{state.error}</FormError>
 *     <Button type="submit" disabled={pending}>
 *       {pending ? "Guardando…" : "Guardar"}
 *     </Button>
 *   </form>
 */

/** Label + control + hint + error, with the product's vertical rhythm. */
export function Field({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="field" className={cn("flex flex-col gap-1.5", className)} {...props} />
  );
}

/** Helper text under a control. Say what the field is for, not "requerido". */
export function FieldHint({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-hint"
      className={cn("text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * The message a failed action came back with.
 *
 * Renders nothing when there's no error, so it drops straight into
 * `<FormError>{state.error}</FormError>` without a ternary around it.
 *
 * `role="alert"` is the whole point of having this as a component: the
 * eighteen hand-written `<p className="text-sm text-destructive">` it
 * replaces were invisible to a screen reader, so a form could fail and
 * announce nothing at all. Pair it with `aria-invalid` on the control that
 * caused it whenever the error is about one specific field.
 */
export function FormError({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) return null;

  return (
    <p
      data-slot="form-error"
      role="alert"
      className={cn("flex items-start gap-1.5 text-sm text-destructive", className)}
      {...props}
    >
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * The confirmation a successful action came back with, for forms that stay
 * on the page after saving. If the screen navigates or the list visibly
 * changes, that *is* the feedback -- don't add a message that says the same
 * thing twice. For an action whose result the user can't see (an invite
 * sent, a reminder queued), prefer a toast.
 */
export function FormSuccess({
  className,
  children,
  ...props
}: React.ComponentProps<"p">) {
  if (!children) return null;

  return (
    <p
      data-slot="form-success"
      role="status"
      className={cn("flex items-start gap-1.5 text-sm text-success", className)}
      {...props}
    >
      <CheckIcon className="mt-0.5 size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
