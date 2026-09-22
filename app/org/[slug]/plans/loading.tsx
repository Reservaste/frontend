import { SkeletonRows } from "@/components/ui/skeleton";

/**
 * The loading state of the organization's whole price list. A skeleton and
 * not a spinner: the screen is a list, and a placeholder the same shape as
 * the rows keeps the page from jumping when they land.
 */
export default function PlansLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 px-5 py-6">
      <SkeletonRows rows={3} label="Cargando planes…" />
    </div>
  );
}
