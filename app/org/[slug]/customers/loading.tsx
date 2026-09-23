import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

export default function CustomersLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-3.5 w-32" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-44 rounded-lg sm:h-9" />
        <Skeleton className="h-11 w-44 rounded-lg sm:h-9" />
      </div>
      <SkeletonRows rows={5} label="Cargando clientes…" />
    </div>
  );
}
