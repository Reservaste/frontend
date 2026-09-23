import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * The public agenda (ADR-0023) is the highest-traffic screen in the
 * product -- an anonymous visitor's first look at the business. Shaped
 * like the real page (header bar, then the calendar) so it doesn't jump
 * when `getPublicOrganization`/`getPublicAvailability` land.
 */
export default function PublicOrganizationLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/70 bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      </header>

      <SkeletonGroup label="Cargando agenda…" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-5 py-5">
        <div className="flex gap-2 overflow-hidden">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-8 w-14 shrink-0 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </SkeletonGroup>
    </div>
  );
}
