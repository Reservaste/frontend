import { TabNav } from "@/components/tab-nav";

export function MeNav() {
  return (
    <TabNav
      className="mx-auto w-full max-w-3xl"
      items={[
        // "Agenda", not "Reservas": the screen behind it stopped being a
        // list of bookings and became a calendar that also shows the
        // classes this person could still take. A fifth tab would have
        // split one question ("¿qué tengo y qué hay?") across two screens.
        // Still `exact`: without it this tab would light up on every other
        // section too, since they all live under /me/.
        { href: "/me", label: "Agenda", exact: true },
        { href: "/me/servicios", label: "Servicios" },
        { href: "/me/pagos", label: "Pagos" },
        { href: "/me/creditos", label: "Créditos" },
      ]}
    />
  );
}
