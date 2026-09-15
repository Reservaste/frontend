import { TabNav } from "@/components/tab-nav";

export function OrgNav({ slug }: { slug: string }) {
  const base = `/org/${slug}`;

  return (
    <TabNav
      className="mx-auto w-full max-w-5xl"
      items={[
        { href: base, label: "Inicio", exact: true },
        { href: `${base}/agenda`, label: "Agenda" },
        { href: `${base}/customers`, label: "Clientes" },
        { href: `${base}/services`, label: "Servicios" },
        { href: `${base}/resources`, label: "Recursos" },
        { href: `${base}/team`, label: "Equipo" },
        { href: `${base}/settings`, label: "Configuración" },
      ]}
    />
  );
}
