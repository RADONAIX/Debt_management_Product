/**
 * CSV export for the register tables.
 *
 * Exports exactly the columns the table shows, in the order it shows them, so
 * the file and the screen never disagree.
 */

export interface CsvColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

const escape = (v: string | number | null | undefined): string => {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function exportRows<T>(rows: T[], columns: CsvColumn<T>[], filename: string): void {
  const lines = [
    columns.map((c) => escape(c.header)).join(","),
    ...rows.map((r) => columns.map((c) => escape(c.value(r))).join(",")),
  ];

  // Lead with a BOM so Excel opens the file as UTF-8 rather than mangling names.
  const blob = new Blob([`\ufeff${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
