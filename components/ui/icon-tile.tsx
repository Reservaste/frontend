import * as React from "react";
import { cn } from "cn";

/**
 * A square icon container -- the "icon in a tinted rounded square" pattern
 * a feature list or a rubric card reaches for.
 *
 * Added by ADR-0030 §4.7.2: the landing (`app/page.tsx`) used to build this
 * exact shape by taking `BrandMark` (the product's logo glyph) and
 * cancelling half its own styles (`bg-none shadow-none`) to make it sit
 * still and hold an unrelated icon. That's not a variant of the logo, it's
 * a different primitive that happened to share a class string -- this is
 * that primitive, so a feature card's icon and "the Reservaste mark" can
 * never again be the same component wearing a disguise.
 *
 * Always `aria-hidden`: the icon repeats what the adjacent heading already
 * says, same rule as every other decorative icon in `components/icons.tsx`.
 */
export function IconTile({
  icon,
  tone = "primary",
  className,
}: {
  icon: React.ReactNode;
  /** `primary` follows whoever owns the screen (org accent or the product's
   * own violet outside `[data-brand]`). `neutral` is for a tile that sits on
   * a surface where the accent would be too loud (e.g. a dark band). */
  tone?: "primary" | "neutral";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg",
        tone === "primary" ? "bg-primary-subtle text-primary" : "bg-muted text-foreground",
        className,
      )}
    >
      {icon}
    </span>
  );
}
