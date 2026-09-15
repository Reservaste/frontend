"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

const ITEMS = [
  { href: "/me", label: "Reservas" },
  { href: "/me/servicios", label: "Servicios" },
  { href: "/me/pagos", label: "Pagos" },
];

export function MeNav() {
  const pathname = usePathname();

  return (
    <nav className="no-scrollbar mx-auto w-full max-w-lg overflow-x-auto px-5">
      <ul className="flex gap-0.5 text-sm">
        {ITEMS.map((item) => {
          const active = item.href === "/me" ? pathname === "/me" : pathname.startsWith(item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
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
