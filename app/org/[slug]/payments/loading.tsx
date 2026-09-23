import { Skeleton, SkeletonRows } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-3.5 w-40" />
        </div>
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <SkeletonRows rows={5} label="Cargando pagos…" />
    </div>
  );
}
