import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getOccurrence, getOccurrenceAttendees } from "@/app/actions/admin";
import { BackLink } from "@/components/back-link";
import { EmptyState } from "@/components/ui/empty-state";
import { RollCall } from "./roll-call";

export const metadata = { title: "Pasar lista" };

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ slug: string; occurrenceId: string }>;
}) {
  const { slug, occurrenceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const [occurrence, attendees] = await Promise.all([
    getOccurrence(slug, occurrenceId),
    getOccurrenceAttendees(slug, occurrenceId),
  ]);

  if (!occurrence) {
    notFound();
  }

  // Someone who cancelled is not in the room and not on the list, but
  // keeps whatever attendance was recorded before (ADR-0022).
  const confirmed = attendees.filter((a) => a.status === "CONFIRMED");

  const start = new Date(occurrence.startAt);
  const end = new Date(occurrence.endAt);
  const dayLabel = new Intl.DateTimeFormat("es-UY", {
    timeZone: organization.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(start);
  const time = (d: Date) =>
    new Intl.DateTimeFormat("es-UY", {
      timeZone: organization.timezone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d);

  return (
    // Wider than a modal on purpose: this is a full screen on a phone and
    // a real page on a desktop, never a dialog you squint into.
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-5 sm:px-5">
      <BackLink href={`/org/${slug}/agenda/${occurrenceId}`}>Turno</BackLink>

      <div className="flex flex-col gap-0.5">
        <h1 className="text-xl">{occurrence.serviceName}</h1>
        <p className="text-sm capitalize text-muted-foreground">
          {dayLabel} · <span className="tnum">{time(start)} – {time(end)}</span>
        </p>
      </div>

      {confirmed.length === 0 ? (
        <EmptyState
          title="Nadie reservó este turno"
          description="Cuando haya reservas confirmadas vas a poder pasar lista acá."
        />
      ) : (
        <RollCall organizationSlug={slug} occurrenceId={occurrenceId} attendees={confirmed} />
      )}
    </div>
  );
}
