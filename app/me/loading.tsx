import { SkeletonRows } from "@/components/ui/skeleton";

/** "Mis reservas" is the landing screen of the customer portal. */
export default function MyBookingsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6">
      <SkeletonRows rows={4} label="Cargando tus reservas…" />
    </div>
  );
}
