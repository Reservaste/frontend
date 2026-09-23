import * as React from "react";
import { cn } from "cn";

/**
 * A styled native `<textarea>`. There is no Base UI primitive for this (only
 * `Input` wraps one) -- native is the right call here too, same reasoning as
 * `Select`: it lives inside a `<form action={serverAction}>`, reads back
 * from `FormData` by name, and needs nothing beyond what the browser gives
 * for free (resize handle, spellcheck, mobile keyboard).
 *
 *   <Field>
 *     <Label htmlFor="message">Mensaje</Label>
 *     <Textarea id="message" name="message" required touch rows={4} />
 *   </Field>
 *
 * Border, focus ring, invalid and disabled treatment mirror `Input` exactly
 * -- same reason `Select` does: one control language, not three drifting
 * copies of the same class string.
 */
function Textarea({
  className,
  touch = false,
  ...props
}: React.ComponentProps<"textarea"> & {
  /** Taller resting height on a phone, same density switch as `Input`. */
  touch?: boolean;
}) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "w-full min-w-0 resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        touch ? "min-h-32" : "min-h-24",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
