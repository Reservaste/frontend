"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { Button } from "@/components/ui/button";

/** Steps the payments screen one calendar month at a time. */
export function MonthPicker({ organizationSlug, month }: { organizationSlug: string; month: string }) {
  const router = useRouter();

  const shift = (delta: number) => {
    const [year, m] = month.split("-").map(Number);
    const next = new Date(Date.UTC(year!, m! - 1 + delta, 1));
    router.push(`/org/${organizationSlug}/payments?mes=${next.toISOString().slice(0, 7)}`);
  };

  const label = new Intl.DateTimeFormat("es-UY", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T12:00:00Z`));

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon-sm" aria-label="Mes anterior" onClick={() => shift(-1)}>
        <ChevronLeft />
      </Button>
      <span className="min-w-36 text-center text-sm font-medium capitalize">{label}</span>
      <Button variant="outline" size="icon-sm" aria-label="Mes siguiente" onClick={() => shift(1)}>
        <ChevronRight />
      </Button>
    </div>
  );
}
