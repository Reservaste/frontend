import { TabNav } from "@/components/tab-nav";

/**
 * The service's own sections (ADR-0023). Reuses the same TabNav as the
 * organization header, so a section bar behaves identically everywhere:
 * same overflow fade, same scroll-the-active-one-into-view on a phone.
 */
export function ServiceTabs({
  organizationSlug,
  serviceId,
}: {
  organizationSlug: string;
  serviceId: string;
}) {
  const base = `/org/${organizationSlug}/services/${serviceId}`;

  return (
    <TabNav
      className="-mx-5 border-b"
      items={[
        { href: `${base}/schedule`, label: "Horarios", exact: true },
        { href: `${base}/agenda`, label: "Agenda" },
        { href: `${base}/asistencia`, label: "Asistencia" },
      ]}
    />
  );
}
