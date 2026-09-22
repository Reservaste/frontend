import * as React from "react";
import { cn } from "cn";

/**
 * Loading placeholders.
 *
 * Use these in `loading.tsx` / `<Suspense fallback>` instead of a spinner:
 * the screens in this product are lists and calendars, and a skeleton that
 * has the same shape as the content that's coming keeps the layout from
 * jumping when it arrives.
 *
 * Rules:
 * - A skeleton stands in for content that is *going to appear*. If the list
 *   might legitimately be empty, that's `EmptyState`, not a skeleton.
 * - Never more than a screenful. Three or four rows read as "loading";
 *   twenty read as a broken page.
 * - Announce once, at the container, not per bar -- hence the `label` on
 *   the composed helpers and `aria-hidden` on the bars themselves.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn("animate-shimmer rounded-md bg-muted", className)}
      {...props}
    />
  );
}

/** Wraps a group of skeletons so screen readers hear "loading" exactly once. */
export function SkeletonGroup({
  label = "Cargando…",
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div role="status" aria-busy="true" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

/** A paragraph of text. The last line is short, like real text is. */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={cn("h-3.5", index === lines - 1 ? "w-2/5" : "w-full")}
        />
      ))}
    </div>
  );
}

/**
 * The product's list shape: a title line, a metadata line, and something
 * on the right. Matches the real row's `px-4 py-3`, so the page doesn't
 * shift when the data lands.
 */
export function SkeletonRows({
  rows = 4,
  label = "Cargando…",
  className,
}: {
  rows?: number;
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonGroup label={label}>
      <ul
        className={cn(
          "flex flex-col gap-2 sm:gap-0 sm:divide-y sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card sm:shadow-card",
          className,
        )}
      >
        {Array.from({ length: rows }, (_, index) => (
          <li
            key={index}
            className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-card sm:rounded-none sm:border-0 sm:shadow-none"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16 rounded-full" />
          </li>
        ))}
      </ul>
    </SkeletonGroup>
  );
}

/** A card-shaped placeholder, for dashboards and detail panels. */
export function SkeletonCard({
  label = "Cargando…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <SkeletonGroup label={label}>
      <div className={cn("flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-card", className)}>
        <Skeleton className="h-4 w-1/3" />
        <SkeletonText lines={2} />
      </div>
    </SkeletonGroup>
  );
}
