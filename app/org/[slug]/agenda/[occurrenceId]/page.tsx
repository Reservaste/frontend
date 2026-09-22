import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getCustomers, getOccurrence, getOccurrenceAttendees } from "@/app/actions/admin";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { OccupancyBar, StatusBadge } from "@/components/status";
import { buttonVariants } from "@/components/ui/button";
import { OccurrenceActions } from "../occurrence-actions";

export const metadata = { title: "Turno" };

export default async function OccurrenceDetailPage({
  params,
}: {
  params: Promise<{ slug: string; occurrenceId: string }>;
}) {
  const { slug, occurrenceId } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const [occurrence, attendees, customers] = await Promise.all([
    getOccurrence(slug, occurrenceId),
    getOccurrenceAttendees(slug, occurrenceId),
    getCustomers(slug),
  ]);

  if (!occurrence) {
    notFound();
  }

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

  const free = occurrence.capacity - occurrence.confirmedCount;
  const cancelled = occurrence.status === "CANCELLED";
  const hasStarted = start < new Date();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-5 py-6">
      <Breadcrumbs
        items={[
          { label: "Agenda", href: `/org/${slug}/agenda` },
          { label: occurrence.serviceName, href: `/org/${slug}/services/${occurrence.serviceId}/schedule` },
          { label: `${dayLabel} ${time(start)}` },
        ]}
      />

      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <Link
              href={`/org/${slug}/services/${occurrence.serviceId}/schedule`}
              className="text-xl font-semibold tracking-tight underline-offset-4 hover:underline"
            >
              {occurrence.serviceName}
            </Link>
            <p className="text-sm capitalize text-muted-foreground">
              {dayLabel} · <span className="tnum">{time(start)} – {time(end)}</span>
            </p>
            <p className="text-xs text-muted-foreground">{occurrence.resourceName}</p>
          </div>

          {cancelled ? (
            <StatusBadge tone="danger">Turno cancelado</StatusBadge>
          ) : (
            <StatusBadge tone={free === 0 ? "danger" : free <= 2 ? "warning" : "success"}>
              {free === 0 ? "Completo" : `${free} disponible${free === 1 ? "" : "s"}`}
            </StatusBadge>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Ocupación</span>
            <span className="tnum font-medium">
              {occurrence.confirmedCount} / {occurrence.capacity}
            </span>
          </div>
          {/* Derived from confirmed bookings, never a stored counter
              (docs/domain.md): cancelling frees the seat immediately. */}
          <OccupancyBar confirmed={occurrence.confirmedCount} capacity={occurrence.capacity} />
        </div>

        {/* Attendance only makes sense once the class has begun; before
            that every row would just say "pendiente". */}
        {hasStarted && !cancelled && occurrence.confirmedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
            <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="tnum">
                <span className="font-semibold text-success">{occurrence.present}</span> presentes
              </span>
              <span className="tnum">
                <span className="font-semibold text-destructive">{occurrence.absent}</span> ausentes
              </span>
              <span className="tnum text-muted-foreground">{occurrence.pending} sin marcar</span>
            </div>
            <Link
              href={`/org/${slug}/agenda/${occurrenceId}/asistencia`}
              className={buttonVariants({ size: "touch" })}
            >
              Pasar lista
            </Link>
          </div>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border bg-card shadow-card">
        <OccurrenceActions
          organizationSlug={slug}
          occurrenceId={occurrenceId}
          capacity={occurrence.capacity}
          attendees={attendees}
          customers={customers}
          isCancelled={cancelled}
        />
      </div>
    </div>
  );
}
