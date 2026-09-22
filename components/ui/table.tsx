import * as React from "react";
import { cn } from "cn";

/**
 * A real `<table>`, for data that is genuinely tabular.
 *
 * **Read this before using it.** Most "tables" in this product are not
 * tables: they're one row per thing with a name, some metadata and a status,
 * and those are built as a list that becomes a divided card from `sm` up --
 * see `DataList` below. A phone is 390px wide and a four-column table there
 * is a horizontal scroller that nobody scrolls.
 *
 * Reach for `Table` when the columns are values you compare *across rows*
 * (a month of payments, a list of plans with prices and frequencies) and the
 * screen is admin-only, where there's a desktop to spend width on.
 *
 *   <TableScroller>
 *     <Table>
 *       <TableHeader>
 *         <TableRow>
 *           <TableHead>Cliente</TableHead>
 *           <TableHead numeric>Total</TableHead>
 *         </TableRow>
 *       </TableHeader>
 *       <TableBody>
 *         {rows.map((row) => (
 *           <TableRow key={row.id}>
 *             <TableCell>{row.name}</TableCell>
 *             <TableCell numeric>{money(row.total)}</TableCell>
 *           </TableRow>
 *         ))}
 *       </TableBody>
 *     </Table>
 *   </TableScroller>
 */

/**
 * The surface a table sits on: card, border, and horizontal scroll when the
 * columns don't fit. Always wrap a `Table` in one -- a table that overflows
 * its container without a scroll box just clips.
 */
export function TableScroller({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="table-scroller"
      className={cn(
        "w-full overflow-x-auto overscroll-x-contain rounded-xl border bg-card shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <table
      data-slot="table"
      className={cn("w-full caption-bottom border-collapse text-sm", className)}
      {...props}
    />
  );
}

export function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  );
}

export function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  );
}

export function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn("border-t bg-muted/50 font-medium", className)}
      {...props}
    />
  );
}

export function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "border-b transition-colors hover:bg-muted/40 data-selected:bg-primary-subtle",
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"th"> & { numeric?: boolean }) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn(
        "h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({
  className,
  numeric = false,
  ...props
}: React.ComponentProps<"td"> & { numeric?: boolean }) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-3 py-2.5 align-middle",
        // Numbers in a column only read as a column when they're tabular
        // and right-aligned -- the same reason .tnum exists.
        numeric && "tnum text-right",
        className,
      )}
      {...props}
    />
  );
}

export function TableCaption({ className, ...props }: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-3 px-3 pb-3 text-left text-xs text-muted-foreground", className)}
      {...props}
    />
  );
}

/**
 * The mobile-first alternative, and the shape most lists in this product
 * already have: separate cards on a phone, one divided card from `sm` up.
 *
 *   <DataList>
 *     {rows.map((row) => (
 *       <DataListRow key={row.id}>
 *         <Link href={…} className="…">…</Link>
 *       </DataListRow>
 *     ))}
 *   </DataList>
 *
 * It renders a `<ul>`, so each child must be a `DataListRow` (`<li>`). The
 * row has no padding of its own: rows are usually a single full-bleed
 * `<Link>`, and padding on the `<li>` would leave a dead strip around it
 * that looks tappable and isn't.
 */
export function DataList({ className, ...props }: React.ComponentProps<"ul">) {
  return (
    <ul
      data-slot="data-list"
      className={cn(
        "flex flex-col gap-2 sm:gap-0 sm:divide-y sm:overflow-hidden sm:rounded-xl sm:border sm:bg-card sm:shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export function DataListRow({ className, ...props }: React.ComponentProps<"li">) {
  return (
    <li
      data-slot="data-list-row"
      className={cn(
        "overflow-hidden rounded-xl border bg-card shadow-card sm:rounded-none sm:border-0 sm:shadow-none",
        className,
      )}
      {...props}
    />
  );
}
