import Link from "next/link";
import { cn } from "cn";
import { BackLink } from "@/components/back-link";
import { ChevronRight } from "@/components/icons";

export interface Crumb {
  label: string;
  /** Omit on the last item: the page you are already on. */
  href?: string;
}

/**
 * Depth, shown two ways on purpose.
 *
 * On a phone a full trail eats a line of screen and still gets truncated,
 * so it collapses to a single back link to the immediate parent -- which
 * is the only part anyone taps. From `sm` up there is room for the whole
 * path, which is what tells you *where* you are rather than just how to
 * leave.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  const parent = [...items].reverse().find((item) => item.href);

  return (
    <div className={className}>
      {parent ? (
        <BackLink href={parent.href!} className="sm:hidden">
          {parent.label}
        </BackLink>
      ) : null}

      <nav aria-label="Ruta de navegación" className="hidden sm:block">
        <ol className="flex flex-wrap items-center text-sm text-muted-foreground">
          {items.map((item, index) => (
            <li key={`${item.label}-${index}`} className="flex items-center">
              {index > 0 ? <ChevronRight className="size-3.5 shrink-0 opacity-50" /> : null}
              {item.href ? (
                <Link
                  href={item.href}
                  className="rounded-md px-1.5 py-1 transition-colors hover:bg-muted hover:text-foreground"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current="page" className={cn("px-1.5 py-1 font-medium text-foreground")}>
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
