import { TabNav, type TabItem } from "@/components/tab-nav";

/**
 * ADR-0033: "Pagos" only for someone whose role can see payments. Hiding the
 * tab is not the authorization (RLS and every payment RPC are), it only
 * keeps the panel from offering a screen the database would answer empty
 * or with NOT_AUTHORIZED. Planes stays for everyone: it is the price list,
 * which is public anyway (docs/api.md, Fase 32).
 */
export function OrgNav({ slug, canViewPayments }: { slug: string; canViewPayments: boolean }) {
  const base = `/org/${slug}`;

  const items: (TabItem | null)[] = [
    { href: base, label: "Inicio", exact: true },
    { href: `${base}/agenda`, label: "Agenda" },
    { href: `${base}/customers`, label: "Clientes" },
    { href: `${base}/services`, label: "Servicios" },
    { href: `${base}/plans`, label: "Planes" },
    canViewPayments ? { href: `${base}/payments`, label: "Pagos" } : null,
    { href: `${base}/resources`, label: "Recursos" },
    { href: `${base}/team`, label: "Equipo" },
    { href: `${base}/settings`, label: "Configuración" },
  ];

  return <TabNav className="mx-auto w-full max-w-5xl" items={items.filter((i): i is TabItem => i !== null)} />;
}
