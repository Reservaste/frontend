import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * The admin Agenda (day/week calendar) is the priority screen of the
 * panel -- shaped like the real page (title, view toggle, grid) so it
 * doesn't jump once `getAgenda`/`listServices` land.
 */
export default function AgendaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3.5 w-48" />
      </div>

      <SkeletonGroup label="Cargando agenda…" className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Skeleton className="h-8 w-20 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
        <Skeleton className="h-[28rem] w-full rounded-xl" />
      </SkeletonGroup>
    </div>
  );
}
