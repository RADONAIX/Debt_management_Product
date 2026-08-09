import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, SearchX } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * One column of a register table.
 *
 * `sortKey` is the key the backend whitelists — a column without one is not
 * sortable, which is the honest default for anything derived in the client.
 */
export interface Column<T> {
  key: string;
  header: string;
  sortKey?: string;
  align?: "left" | "right";
  /** Tailwind width hint, e.g. "w-32". */
  className?: string;
  cell: (row: T) => ReactNode;
}

interface ReportTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading: boolean;
  /** Total across the whole filtered set, not just this page. */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort?: string;
  dir: "asc" | "desc";
  onSortChange: (sort: string, dir: "asc" | "desc") => void;
  emptyMessage?: string;
}

export function ReportTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  sort,
  dir,
  onSortChange,
  emptyMessage = "No records match these filters",
}: ReportTableProps<T>) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    // First click on a new column sorts descending — for money and dates that
    // is what a collections user wants to see first.
    if (sort === key) onSortChange(key, dir === "asc" ? "desc" : "asc");
    else onSortChange(key, "desc");
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={[
                    "whitespace-nowrap text-xs font-medium",
                    col.align === "right" ? "text-right" : "",
                    col.className ?? "",
                  ].join(" ")}
                >
                  {col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sortKey!)}
                      className={`inline-flex items-center gap-1 hover:text-foreground transition-colors ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      } ${sort === col.sortKey ? "text-foreground" : ""}`}
                    >
                      {col.header}
                      {sort === col.sortKey ? (
                        dir === "asc" ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40">
                  <div className="flex flex-col items-center justify-center gap-2 text-center">
                    <SearchX className="h-7 w-7 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">{emptyMessage}</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow key={rowKey(row)} className="text-sm">
                  {columns.map((col) => (
                    <TableCell
                      key={col.key}
                      className={`whitespace-nowrap py-2.5 ${
                        col.align === "right" ? "text-right tabular-nums" : ""
                      }`}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-muted-foreground">
          {loading
            ? "Loading…"
            : `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${total.toLocaleString()}`}
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            Previous
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums">
            Page {page + 1} of {pages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={loading || page + 1 >= pages}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
