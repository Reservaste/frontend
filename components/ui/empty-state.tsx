import * as React from "react";
import { cn } from "cn";

/**
 * "Nothing here yet", said the same way everywhere.
 *
 * Every empty list in the product goes through this, so an empty screen
 * always looks intentional and always offers the next step instead of being
 * a dead grey sentence. There were eight variants of a dashed box with a
 * muted sentence in it before this existed, with three different paddings.
 *
 * Two sizes, because "nothing here yet" comes in two flavours:
 *
 * - `default` — the list is empty because the business hasn't set this up
 *   yet. It's the main thing on the screen, so it gets an icon, a title, a
 *   sentence and an action: "Todavía no tenés servicios" + "Crear servicio".
 *
 * - `sm` — the list is empty because of a filter or a search. Nothing is
 *   wrong and there's nothing to set up, so it's one quiet line that doesn't
 *   take over the page: "Ningún cliente coincide con ese filtro."
 *
 * Write the title as a fact and the action as a verb. A title that says
 * "Sin datos" tells the owner nothing about what to do next.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  size?: "default" | "sm";
  className?: string;
}) {
  if (size === "sm") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-6 text-center",
          className,
        )}
      >
        <p className="text-sm text-muted-foreground">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-xs text-muted-foreground">{description}</p>
        ) : null}
        {action}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {icon}
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
