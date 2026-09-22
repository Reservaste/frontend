import { redirect } from "next/navigation";

/**
 * Planes dejó de vivir "dentro" de un Service (pedido del dueño, después de
 * ADR-0029: un plan puede cubrir 1, 2, 3 o todos los servicios, así que
 * gestionarlo desde uno solo ya no representa el dominio). La gestión real
 * está ahora en `/org/[slug]/plans`, una sección de nivel superior; esta
 * ruta vieja solo redirige, con el servicio como filtro preseleccionado,
 * para no romper enlaces/bookmarks existentes.
 */
export default async function LegacyServicePlansRedirect({
  params,
}: {
  params: Promise<{ slug: string; serviceId: string }>;
}) {
  const { slug, serviceId } = await params;
  redirect(`/org/${slug}/plans?serviceId=${serviceId}`);
}
