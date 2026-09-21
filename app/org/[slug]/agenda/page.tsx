import { requireOrganizationMembership } from "@/app/actions/organizations";
import { getAgenda } from "@/app/actions/admin";
import { listServices } from "@/app/actions/services";
import { PageHeader } from "@/components/page-header";
import { AgendaCalendar } from "@/components/calendar/agenda-calendar";

export const metadata = { title: "Agenda" };

// The whole rolling window at once (ADR-0009 materializes 90 days), so
// switching between day, week and month never waits on the network. A
// few hundred rows is nothing; paginating this would cost a round trip on
// every arrow press to save bytes nobody is counting.
const DAYS_BACK = 30;
const DAYS_FORWARD = 95;

export default async function AgendaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { organization } = await requireOrganizationMembership(slug);

  const now = new Date();
  const from = new Date(now.getTime() - DAYS_BACK * 86_400_000);
  const to = new Date(now.getTime() + DAYS_FORWARD * 86_400_000);

  const [occurrences, services] = await Promise.all([
    getAgenda(slug, from, to),
    listServices(slug),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-5 py-6">
      <PageHeader
        title="Agenda"
        description={`Horarios en ${organization.timezone.replace("_", " ")}`}
      />

      <AgendaCalendar
        organizationSlug={slug}
        occurrences={occurrences}
        services={services.map((s) => ({ id: s.id, name: s.name, color: s.color }))}
        timeZone={organization.timezone}
      />
    </div>
  );
}
