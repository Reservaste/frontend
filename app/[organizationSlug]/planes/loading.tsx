import { Skeleton, SkeletonGroup } from "@/components/ui/skeleton";

/**
 * Misma silueta que la página real (barra del negocio + tarjetas de plan)
 * para que no salte cuando llegan `getPublicOrganization` y
 * `listPublicServicePlans`.
 */
export default function PublicPlansLoading() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border/70 bg-card shadow-card">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3 px-5 py-4">
          <Skeleton className="size-10 shrink-0 rounded-full" />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      </header>

      <SkeletonGroup
        label="Cargando planes…"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-5 py-5"
      >
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-40 w-full rounded-2xl" />
        ))}
      </SkeletonGroup>
    </div>
  );
}
