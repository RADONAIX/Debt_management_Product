import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Building2, Search, User } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export interface PickerOption {
  id: string;
  name: string;
  segment: string;
  isCompany?: boolean;
}

/**
 * Searchable customer picker. Companies and individuals are listed separately
 * because they are different things to select, and the search matches on name,
 * code and segment so a subscriber number or CUST- code finds its row.
 */
export const CustomerPicker = ({
  options,
  value,
  onChange,
  placeholder = "Search customers or companies…",
}: {
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.name} ${o.id} ${o.segment}`.toLowerCase().includes(q),
    );
  }, [options, query]);

  const companies = filtered.filter((o) => o.isCompany);
  const people = filtered.filter((o) => !o.isCompany);
  const selected = options.find((o) => o.id === value);

  const row = (o: PickerOption) => (
    <button
      key={o.id}
      onClick={() => {
        onChange(o.id);
        setOpen(false);
        setQuery("");
      }}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-muted transition-colors ${
        o.id === value ? "bg-primary/5" : ""
      }`}
    >
      {o.isCompany ? (
        <Building2 className="h-3.5 w-3.5 text-primary shrink-0" />
      ) : (
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className="flex-1 min-w-0">
        <span className="block truncate text-foreground">{o.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {o.id} · {o.segment}
        </span>
      </span>
      {o.id === value && <Check className="h-4 w-4 text-primary shrink-0" />}
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="w-[320px] h-10 flex items-center gap-2 rounded-md border border-input bg-background px-3 text-sm hover:bg-muted/40 transition-colors"
        >
          {selected?.isCompany ? (
            <Building2 className="h-4 w-4 text-primary shrink-0" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground shrink-0" />
          )}
          <span className="flex-1 truncate text-left">
            {selected ? selected.name : "Select a customer"}
          </span>
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-[360px] p-0" align="end">
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5 space-y-1">
          {companies.length > 0 && (
            <>
              <div className="flex items-center justify-between px-2 pt-1 pb-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Companies
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                  {companies.length}
                </Badge>
              </div>
              {companies.map(row)}
            </>
          )}

          {people.length > 0 && (
            <>
              <div className="flex items-center justify-between px-2 pt-2 pb-0.5">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
                  Customers
                </span>
                <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                  {people.length}
                </Badge>
              </div>
              {people.map(row)}
            </>
          )}

          {filtered.length === 0 && (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};
