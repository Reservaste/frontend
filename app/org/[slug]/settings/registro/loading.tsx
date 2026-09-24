import { SkeletonRows } from "@/components/ui/skeleton";

/** Loading state of the audit log: a list, so a list-shaped skeleton. */
export default function AuditLogLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <SkeletonRows rows={5} label="Cargando registro…" />
    </div>
  );
}
