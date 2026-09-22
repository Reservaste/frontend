import {
  AlertCircle,
  AlertTriangle,
  Check,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  Info,
  X,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";
import { cn } from "cn";

/**
 * Every icon in the product goes through here, re-exported from
 * `lucide-react` (already a dependency) instead of hand-drawn `<svg>`. Before
 * this, six places drew their own chevron with slightly different stroke
 * widths, and `dialog`/`toast`/`form` each drew their own close/error/check
 * mark by hand — that's exactly the drift the sistema visual pass exists to
 * cut.
 *
 * `size-4` (16px) is the default because that's what every existing call
 * site already assumed when the chevrons were hand-drawn; pass a `size-*`
 * className to override, same as before (`ChevronRight` in `dashboard/page.tsx`
 * does this to sit at `text-muted-foreground` size next to a row's text).
 *
 * Need an icon that isn't re-exported yet? Add it here, don't import
 * `lucide-react` directly in a screen — this file is what lets
 * `code-review-agent` grep one place for "which icons does this product use".
 */
function withDefaultSize(Icon: LucideIcon) {
  return function Wrapped({ className, ...props }: LucideProps) {
    return <Icon className={cn("size-4", className)} aria-hidden {...props} />;
  };
}

/** Navigation affordance: "there's more this way" / "go back". */
export const ChevronLeft = withDefaultSize(LucideChevronLeft);
export const ChevronRight = withDefaultSize(LucideChevronRight);

/** Dismiss a dialog/sheet/toast. */
export const CloseIcon = withDefaultSize(X);
/** A single confirmed/success mark inline with text (see `FormSuccess`). */
export const CheckIcon = withDefaultSize(Check);
/** A single error mark inline with text (see `FormError`). */
export const AlertCircleIcon = withDefaultSize(AlertCircle);
/** "You can act on this" — pairs with `Alert tone="warning"`. */
export const AlertTriangleIcon = withDefaultSize(AlertTriangle);
/** "Nothing's wrong, just information" — pairs with `Alert tone="info"`. */
export const InfoIcon = withDefaultSize(Info);
