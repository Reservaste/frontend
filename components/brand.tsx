import Link from "next/link";
import { cn } from "cn";

/**
 * The mark: a rounded square holding a calendar grid where one cell is
 * filled -- a taken slot, the product in one glyph. Two things give it
 * more presence than a flat coloured square without touching the glyph
 * itself: a subtle diagonal gradient between --primary and --primary-hover
 * (still fully driven by the org's accent under [data-brand], never a
 * hardcoded brand colour -- ADR-0020) and a filled cell that carries a
 * touch of its own shadow, so it reads as sitting slightly above the grid
 * rather than painted flat onto it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary-hover text-primary-foreground shadow-card",
        className,
      )}
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="size-4">
        <rect x="3" y="5" width="18" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M3 10h18" stroke="currentColor" strokeWidth="2" />
        <path d="M8 2.5V6M16 2.5V6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <rect x="7" y="13" width="4.5" height="4" rx="1.5" fill="currentColor" fillOpacity="0.95" />
      </svg>
    </span>
  );
}

export function Brand({
  href = "/",
  label = "Reservaste",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)}>
      <BrandMark />
      <span className="text-[15px] font-semibold tracking-tight">{label}</span>
    </Link>
  );
}
