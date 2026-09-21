import { redirect } from "next/navigation";

/**
 * The business's public page is the agenda now (ADR-0023), so this route
 * has nothing of its own left to show. Kept as a redirect rather than
 * deleted: it is what every "Reservar" link printed, shared or bookmarked
 * before this change points at.
 */
export default async function ReservarPage({
  params,
}: {
  params: Promise<{ organizationSlug: string }>;
}) {
  const { organizationSlug } = await params;
  redirect(`/${organizationSlug}`);
}
