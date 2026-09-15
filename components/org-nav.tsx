"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const ITEMS = [
  { href: "", label: "Inicio" },
  { href: "/agenda", label: "Agenda" },
  { href: "/customers", label: "Clientes" },
  { href: "/services", label: "Servicios" },
  { href: "/resources", label: "Recursos" },
  { href: "/team", label: "Equipo" },
  { href: "/settings", label: "Configuración" },
];

/**
 * Client component purely so the current section can be highlighted --
 * without it every tab looked identical and you couldn't tell where you
 * were.
 */
export function OrgNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/org/${slug}`;

  return (
    <nav className="mx-auto w-full max-w-5xl overflow-x-auto px-5">
      <ul className="flex gap-0.5 text-sm">
        {ITEMS.map((item) => {
          const href = `${base}${item.href}`;
          const active = item.href === "" ? pathname === base : pathname.startsWith(href);

          return (
            <li key={item.href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition-colors",
                  active
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
