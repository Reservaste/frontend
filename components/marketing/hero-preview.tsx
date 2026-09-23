import { cn } from "cn";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/**
 * The hero's right-hand visual (ADR-0030 §3.2): a static card built from the
 * product's own tokens that imitates the real public agenda -- three
 * timeslots, one of them full. Deliberately not a screenshot: a screenshot
 * goes stale the next time the calendar's design changes, and a static SVG
 * export can't be restyled by a future accent change the way this can.
 *
 * `aria-hidden` on the decorative card plus one `sr-only` sentence
 * describing it, same pattern as every decorative graphic in this product --
 * a screen reader gets one sentence instead of three rows of a table that
 * isn't one. The `sr-only` sentence is a **sibling** of the `aria-hidden`
 * wrapper, not nested inside it: `aria-hidden` removes its entire subtree
 * from the accessibility tree regardless of `sr-only` on a descendant, so
 * nesting it there would silently drop the sentence entirely (see
 * `SkeletonGroup` in components/ui/skeleton.tsx for the same pattern).
 */
const ROWS: { time: string; service: string; label: string; tone: BadgeTone }[] = [
  { time: "09:00", service: "Consulta general", label: "4 lugares", tone: "success" },
  { time: "10:30", service: "Clase de pilates", label: "Últimos lugares", tone: "warning" },
  { time: "18:00", service: "Cancha 1", label: "Completo", tone: "danger" },
];

export function HeroPreview() {
  return (
    <div className="relative">
      <p className="sr-only">
        Vista de ejemplo de una agenda pública: tres horarios del día con su disponibilidad, uno de
        ellos completo.
      </p>
      <div className="relative" aria-hidden>
        <div className="brand-wash pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem]" />
        <div className="flex flex-col gap-4 rounded-2xl border bg-card p-5 shadow-raised">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Estudio Central</span>
              <span className="text-xs text-muted-foreground">Miércoles 24 de setiembre</span>
            </div>
            <span className="eyebrow text-primary">Hoy</span>
          </div>
          <div className="flex flex-col gap-2">
            {ROWS.map((row) => (
              <div
                key={row.time}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5",
                  row.tone === "danger" && "opacity-70",
                )}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="tnum text-sm font-semibold">{row.time}</span>
                  <span className="truncate text-sm text-muted-foreground">{row.service}</span>
                </div>
                <Badge tone={row.tone} variant={row.tone === "danger" ? "solid" : "subtle"}>
                  {row.label}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
