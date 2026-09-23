import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * This route only redirects to `/[organizationSlug]` (ADR-0023 moved the
 * booking flow onto the public agenda) -- there's no data fetch of its own,
 * so this should be on screen for a blink at most. Kept anyway so a slow
 * redirect (cold navigation, throttled connection) never shows a blank
 * frame between the old bookmarked link and the page it lands on.
 */
export default function ReservarLoading() {
  return (
    <SkeletonGroup label="Cargando…" className="flex flex-1 flex-col items-center justify-center px-5 py-10">
      <Skeleton className="h-8 w-40 rounded-lg" />
    </SkeletonGroup>
  );
}
