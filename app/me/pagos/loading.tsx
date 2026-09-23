import { SkeletonRows } from "@/components/ui/skeleton";

export default function MyPaymentsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <SkeletonRows rows={4} label="Cargando tus pagos…" />
    </div>
  );
}
