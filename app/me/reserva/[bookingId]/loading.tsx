import { SkeletonCard } from "@/components/ui/skeleton";

export default function MyBookingLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <SkeletonCard label="Cargando tu reserva…" className="h-64" />
    </div>
  );
}
