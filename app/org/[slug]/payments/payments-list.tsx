"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { cn } from "cn";
import type { PaymentSummaryRow, RollupStatus } from "@/app/actions/payments";
import { StatusBadge } from "@/components/status";
import { Input } from "@/components/ui/input";
import { DataList, DataListRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { ChevronRight } from "@/components/icons";

const STATUS_META: Record<
  RollupStatus,
  { label: string; tone: "success" | "warning" | "danger" | "neutral" }
> = {
  PAID: { label: "Pagado", tone: "success" },
  PARTIAL: { label: "Pago parcial", tone: "warning" },
  PENDING: { label: "Pendiente", tone: "warning" },
  OVERDUE: { label: "Vencido", tone: "danger" },
  NO_PAYMENTS: { label: "Sin pagos", tone: "neutral" },
};

const FILTERS: { value: "ALL" | RollupStatus; label: string }[] = [
  { value: "ALL", label: "Todos" },
  { value: "PAID", label: "Pagados" },
  { value: "PENDING", label: "Pendientes" },
  { value: "OVERDUE", label: "Vencidos" },
  { value: "PARTIAL", label: "Pago parcial" },
  { value: "NO_PAYMENTS", label: "Sin pagos" },
];

const money = (value: number) => `$${value.toLocaleString("es-UY")}`;

/**
 * Who paid and who did not, for one month.
 *
 * Filtering and searching are client-side on purpose: the list is one
 * row per customer of one business, so it fits in memory many times over,
 * and a round trip per keystroke would make it feel slower than it is.
 */
export function PaymentsList({
  organizationSlug,
  month,
  rows,
}: {
  organizationSlug: string;
  month: string;
  rows: PaymentSummaryRow[];
}) {
  const [filter, setFilter] = useState<"ALL" | RollupStatus>("ALL");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "ALL" && row.rollupStatus !== filter) return false;
      if (needle && !row.customerName.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, filter, query]);

  const totals = useMemo(
    () =>
      visible.reduce(
        (acc, row) => ({ paid: acc.paid + row.paid, pending: acc.pending + row.pending }),
        { paid: 0, pending: 0 },
      ),
    [visible],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Cobrado", value: money(totals.paid) },
          { label: "Por cobrar", value: money(totals.pending) },
          { label: "Clientes", value: String(visible.length) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 rounded-xl border bg-card px-4 py-3 shadow-card">
            <span className="eyebrow text-muted-foreground">{stat.label}</span>
            <span className="tnum text-xl font-semibold leading-none">{stat.value}</span>
          </div>
        ))}
      </div>

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Buscar por nombre"
        aria-label="Buscar cliente"
      />

      <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5">
        {FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setFilter(option.value)}
            aria-pressed={filter === option.value}
            className={cn(
              "focus-ring shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === option.value
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:bg-muted",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState size="sm" title="Ningún cliente coincide con ese filtro." />
      ) : (
        <DataList>
          {visible.map((row) => {
            const meta = STATUS_META[row.rollupStatus];
            return (
              <DataListRow key={row.customerId}>
                <Link
                  href={`/org/${organizationSlug}/payments/${row.customerId}?mes=${month}`}
                  className="focus-ring flex min-h-11 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate font-medium">{row.customerName}</span>
                    <span className="text-xs text-muted-foreground">
                      {row.servicesCount === 0
                        ? "sin servicios este mes"
                        : `${row.servicesCount} servicio${row.servicesCount === 1 ? "" : "s"}`}
                      {row.pending > 0 ? ` · ${money(row.pending)} pendiente` : ""}
                    </span>
                  </div>

                  <span className="tnum text-sm font-semibold">{money(row.total)}</span>
                  <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                  <ChevronRight className="shrink-0 text-muted-foreground" />
                </Link>
              </DataListRow>
            );
          })}
        </DataList>
      )}
    </div>
  );
}
