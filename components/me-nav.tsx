import { TabNav } from "@/components/tab-nav";

export function MeNav() {
  return (
    <TabNav
      className="mx-auto w-full max-w-lg"
      items={[
        { href: "/me", label: "Reservas", exact: true },
        { href: "/me/servicios", label: "Servicios" },
        { href: "/me/pagos", label: "Pagos" },
        { href: "/me/creditos", label: "Créditos" },
      ]}
    />
  );
}
