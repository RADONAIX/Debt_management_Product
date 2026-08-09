import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ApiError } from "@/lib/api";
import { money } from "@/lib/money";
import type { Page, PageQuery, ReportFilters } from "@/lib/reports";
import { ReportTable, type Column } from "./ReportTable";
import { ReportFilterBar, type SelectFilter } from "./ReportFilterBar";
import { exportRows, type CsvColumn } from "../utils/exportReports";

const PAGE_SIZE = 25;
/** The backend's ceiling for a single request — an export beyond this truncates. */
const EXPORT_LIMIT = 1000;

interface RegisterTabProps<T> {
  /** Fetches one page of the register. */
  fetcher: (f: ReportFilters, q: PageQuery) => Promise<Page<T>>;
  columns: Column<T>[];
  csvColumns: CsvColumn<T>[];
  rowKey: (row: T) => string | number;
  selects: SelectFilter[];
  searchPlaceholder: string;
  dateLabel: string;
  defaultSort: string;
  /** What the totalAmount column means on this tab, e.g. "promised". */
  amountLabel: string;
  exportName: string;
  /** The header's Customer Scope, applied on top of the tab's own filters. */
  customerScope: "all" | "consumer" | "enterprise";
}

/**
 * One register: filter bar, table, paging and export.
 *
 * The tab owns its filters and paging, so switching tabs never carries a
 * dispute's priority filter over to a promise.
 */
export function RegisterTab<T>({
  fetcher,
  columns,
  csvColumns,
  rowKey,
  selects,
  searchPlaceholder,
  dateLabel,
  defaultSort,
  amountLabel,
  exportName,
  customerScope,
}: RegisterTabProps<T>) {
  const [filters, setFilters] = useState<ReportFilters>({});
  const [sort, setSort] = useState(defaultSort);
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const scoped = useMemo<ReportFilters>(
    () => ({ ...filters, customerScope }),
    [filters, customerScope],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetcher(scoped, {
        sort,
        dir,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setRows(res.rows);
      setTotal(res.total);
      setTotalAmount(res.totalAmount);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Could not load this report. Please try again.",
      );
      setRows([]);
      setTotal(0);
      setTotalAmount(0);
    } finally {
      setLoading(false);
    }
  }, [fetcher, scoped, sort, dir, page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Any change to what is being filtered invalidates the current page number.
  const changeFilter = (key: keyof ReportFilters, value: string | undefined) => {
    setPage(0);
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetcher(scoped, { sort, dir, limit: EXPORT_LIMIT, offset: 0 });
      exportRows(res.rows, csvColumns, exportName);
      toast.success("Export ready", {
        description:
          res.total > res.rows.length
            ? `First ${res.rows.length.toLocaleString()} of ${res.total.toLocaleString()} rows — narrow the filters to export the rest`
            : `${res.rows.length.toLocaleString()} rows downloaded as CSV`,
      });
    } catch (e) {
      toast.error("Export failed", {
        description: e instanceof ApiError ? e.message : "Please try again.",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ReportFilterBar
        filters={filters}
        onChange={changeFilter}
        onReset={() => {
          setPage(0);
          setFilters({});
        }}
        selects={selects}
        searchPlaceholder={searchPlaceholder}
        dateLabel={dateLabel}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {total.toLocaleString()}
          </span>{" "}
          record{total === 1 ? "" : "s"} ·{" "}
          <span className="font-medium text-foreground tabular-nums">{money(totalAmount)}</span>{" "}
          {amountLabel}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={handleExport} disabled={exporting || total === 0}>
            <Download className="h-4 w-4 mr-2" />
            {exporting ? "Exporting…" : "Export CSV"}
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <ReportTable
        columns={columns}
        rows={rows}
        rowKey={rowKey}
        loading={loading}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        sort={sort}
        dir={dir}
        onSortChange={(s, d) => {
          setPage(0);
          setSort(s);
          setDir(d);
        }}
      />
    </div>
  );
}
