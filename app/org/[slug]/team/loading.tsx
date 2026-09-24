import { SkeletonRows } from "@/components/ui/skeleton";

/** Loading state of Equipo: invitations, people and roles are all lists. */
export default function TeamLoading() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <SkeletonRows rows={4} label="Cargando equipo…" />
    </div>
  );
}
