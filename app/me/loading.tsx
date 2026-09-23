import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * "Mi agenda" is the landing screen of the customer portal, and it is a
 * calendar now -- a stack of list rows as its placeholder made the whole
 * page jump when the grid arrived. Toolbar, chips, grid: the same three
 * shapes, in the same order.
 */
export default function MyAgendaLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-5 py-6">
      <SkeletonGroup label="Cargando tu agenda…" className="flex flex-col gap-4">
        <Skeleton className="h-8 w-40" />
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-11 w-28 rounded-full" />
          <Skeleton className="h-11 w-36 rounded-full" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </SkeletonGroup>
    </div>
  );
}
