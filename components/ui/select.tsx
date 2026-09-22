import * as React from "react";
import { cn } from "cn";

/**
 * A styled native `<select>`.
 *
 * Native on purpose. Every select in this product lives inside a
 * `<form action={serverAction}>` and is read back from `FormData` by name,
 * and on a phone the platform picker is better than anything we'd build:
 * it's a full-screen wheel, it handles long option lists, and it needs no
 * JavaScript. A listbox-style select (Base UI has one) is worth reaching
 * for only when an option needs to be more than a string -- an avatar, two
 * lines, a price.
 *
 *   <Field>
 *     <Label htmlFor="serviceId">Servicio</Label>
 *     <Select id="serviceId" name="serviceId" required>
 *       <option value="">Elegir servicio…</option>
 *       {services.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
 *     </Select>
 *   </Field>
 *
 * An empty first `<option>` is not decoration: with `required` it's what
 * makes the browser block a submit where nothing was chosen, because a
 * select always has a value otherwise.
 *
 * Height, border, focus ring and disabled treatment are the same as
 * `Input`, which is the point: this replaces eight copies of the same class
 * string that had already drifted into three different variants, one of
 * which had no focus ring at all.
 */
export function Select({
  className,
  touch = false,
  ...props
}: React.ComponentProps<"select"> & {
  /**
   * 44px tall on a phone, back to the desktop density from `sm` up. Use it
   * on every customer- and public-facing form. It's a boolean and not a
   * `size` prop because `<select size={n}>` is already an HTML attribute.
   */
  touch?: boolean;
}) {
  return (
    <select
      data-slot="select"
      className={cn(
        "w-full min-w-0 rounded-lg border border-input bg-background px-2.5 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30",
        touch ? "h-11 sm:h-9" : "h-8",
        className,
      )}
      {...props}
    />
  );
}
