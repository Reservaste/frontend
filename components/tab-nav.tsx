"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "cn";

export interface TabItem {
  href: string;
  label: string;
  /** Match only this exact path -- for section roots like "Inicio". */
  exact?: boolean;
}

/**
 * The section bar for the admin panel and the customer portal.
 *
 * It scrolls horizontally, which on a phone used to mean four of the
 * seven sections were simply invisible: the scrollbar is hidden (it
 * looked broken in the header) and nothing else said there was more. Two
 * things fix that -- a fade at whichever edge still has content behind
 * it, and scrolling the current section into view, so you can always see
 * which one you are on instead of guessing from the page title.
 */
export function TabNav({ items, className }: { items: TabItem[]; className?: string }) {
  const pathname = usePathname();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLAnchorElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // A couple of pixels of slack: sub-pixel widths otherwise leave the
    // fade permanently on at the end of the scroll.
    setEdges({
      left: el.scrollLeft > 2,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    // "nearest" on the block axis so this never scrolls the page itself,
    // only the bar.
    activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
    updateEdges();
  }, [pathname, updateEdges]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateEdges]);

  return (
    <div className={cn("relative", className)}>
      <div ref={scrollerRef} onScroll={updateEdges} className="no-scrollbar overflow-x-auto px-5">
        <ul className="flex gap-0.5 text-sm">
          {items.map((item) => {
            const active = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  ref={active ? activeRef : undefined}
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
      </div>

      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-card to-transparent transition-opacity",
          edges.left ? "opacity-100" : "opacity-0",
        )}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-card to-transparent transition-opacity",
          edges.right ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
