import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle, Archive, Building2, ChevronDown, ChevronRight, Columns3, Loader2,
  Plus, Rows3,
  Search, SlidersHorizontal, TrendingUp, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { money, moneyShort } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  ESCALATION_TARGETS, GROUP_LABELS, SORT_OPTIONS, bulkAction, getBoard, getTags,
  transitionCase,
  type BoardFilters, type BoardResponse, type CollectionConfig, type TagRow,
} from "@/lib/collection";
import { CaseWizard } from "./CaseWizard";
import { TicketCardView } from "./TicketCard";
import { PRIORITY_TONE, Pill, RISK_TONE, STATE_TONE, pretty } from "./shared";

/**
 * The ticket board — every case as a ticket, in either a grouped list or a
 * Kanban board, grouped by whichever dimension is selected.
 *
 * Dragging a card between status columns performs the workflow transition, so
 * the board is not a separate view of the truth but a way of changing it.
 */
export const TicketBoard = ({
  config, canEdit, agentId, onOpenCase, onOpenCustomer,
}: {
  config: CollectionConfig | null;
  canEdit: boolean;
  /** Whose desk to show. undefined = own, 0 = whole floor (supervisors only).
   *  The server enforces this regardless of what is sent. */
  agentId?: number;
  onOpenCase: (id: number) => void;
  onOpenCustomer?: (code: string) => void;
}) => {
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"LIST" | "BOARD">("LIST");
  const [groupBy, setGroupBy] = useState("CUSTOMER");
  // Roll every subscriber of a company under one header. Off, each customer
  // stands on their own with the company shown beside the name.
  const [byCompany, setByCompany] = useState(false);
  const [sortBy, setSortBy] = useState("PRIORITY");
  const [filters, setFilters] = useState<BoardFilters>({ category: "OPEN" });
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Which grouping the open-set belongs to, so changing dimension reseeds it.
  const [openFor, setOpenFor] = useState<string>("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const effectiveGroup = byCompany ? "COMPANY" : groupBy;
      const b = await getBoard({
        ...filters, groupBy: effectiveGroup, sortBy, agentId,
        search: search.trim() || undefined, limit: 800,
      });
      setBoard(b);
      // A handful of groups start open; a long list starts collapsed.
      setOpenFor((prev) => {
        if (prev !== effectiveGroup) {
          setOpen(new Set(b.columns.length <= 6 ? b.columns.map((c) => c.key) : []));
          return effectiveGroup;
        }
        return prev;
      });
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not load the board.");
    } finally {
      setLoading(false);
    }
  }, [filters, groupBy, sortBy, search, byCompany, agentId]);

  useEffect(() => {
    getTags().then(setTags).catch(() => undefined);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => void load(), 220);
    return () => clearTimeout(t);
  }, [load]);

  // Grouping by customer only makes sense as a list; the board needs columns
  // that a card can be dragged between.
  useEffect(() => {
    // The board needs columns a card can be dragged between; a per-customer or
    // per-company column list is a list, not a board.
    if (view === "BOARD" && groupBy === "CUSTOMER") setGroupBy("STATUS");
    if (view === "BOARD" && byCompany) setByCompany(false);
  }, [view, groupBy, byCompany]);

  const toggleGroup = (k: string) =>
    setOpen((o) => {
      const n = new Set(o);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const togglePick = (id: number) =>
    setPicked((p) => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  /** Dropping a card on a column runs the workflow transition behind it. */
  const drop = async (toState: string) => {
    setDragOver(null);
    const ids = [...picked];
    const raw = ids.length ? ids : [];
    if (!raw.length) return;
    setBusy(true);
    try {
      if (raw.length === 1) {
        await transitionCase(raw[0], { toState, note: "Moved on the board" });
      } else {
        const r = await bulkAction({ caseIds: raw, action: "STATUS", toState,
                                     reason: "Moved on the board" });
        if (r.failed) r.messages.slice(0, 3).forEach((m) => toast.error(m));
      }
      toast.success(`Moved to ${pretty(toState)}.`);
      setPicked(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That move is not allowed.");
    } finally {
      setBusy(false);
    }
  };

  const dropOne = async (id: number, toState: string) => {
    setDragOver(null);
    setBusy(true);
    try {
      await transitionCase(id, { toState, note: "Moved on the board" });
      toast.success(`Moved to ${pretty(toState)}.`);
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "That move is not allowed.");
    } finally {
      setBusy(false);
    }
  };

  const runBulk = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!picked.size) return;
    setBusy(true);
    try {
      const r = await bulkAction({ caseIds: [...picked], action, ...extra });
      toast.success(`${r.ok} updated${r.failed ? `, ${r.failed} failed` : ""}.`);
      r.messages.slice(0, 3).forEach((m) => toast.error(m));
      setPicked(new Set());
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Bulk action failed.");
    } finally {
      setBusy(false);
    }
  };

  const activeFilters = useMemo(
    () =>
      Object.entries(filters).filter(
        ([k, v]) => v !== undefined && v !== false && v !== "" && k !== "category",
      ) as [string, string | number | boolean][],
    [filters],
  );

  const setF = (k: keyof BoardFilters, v: unknown) =>
    setFilters((f) => ({ ...f, [k]: v === "ALL" || v === "" ? undefined : v }));

  return (
    <div className="space-y-3">
      {/* --- Controls ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
          <button onClick={() => setView("LIST")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              view === "LIST" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Rows3 className="h-3.5 w-3.5" /> List
          </button>
          <button onClick={() => setView("BOARD")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
              view === "BOARD" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            <Columns3 className="h-3.5 w-3.5" /> Board
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Group by</span>
          <Select value={groupBy} onValueChange={setGroupBy} disabled={byCompany}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder={byCompany ? "Company" : undefined} />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GROUP_LABELS)
                .filter(([k]) => k !== "COMPANY")
                .filter(([k]) => !(view === "BOARD" && k === "CUSTOMER"))
                .map(([k, label]) => (
                  <SelectItem key={k} value={k}>{label}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground">Sort</span>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="h-9 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map(([k, label]) => (
                <SelectItem key={k} value={k}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="h-9 pl-8 text-sm" value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search customer, case, account, phone, email, promise or dispute" />
        </div>

        {(activeFilters.length > 0 || search || byCompany ||
          groupBy !== "CUSTOMER" || sortBy !== "PRIORITY") && (
          <button
            onClick={() => {
              setFilters({ category: "OPEN" });
              setSearch("");
              setGroupBy("CUSTOMER");
              setSortBy("PRIORITY");
              setByCompany(false);
              setPicked(new Set());
            }}
            className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-destructive hover:border-destructive/40 transition"
          >
            <X className="h-3.5 w-3.5" /> Clear all
          </button>
        )}

        <label
          title="Roll every subscriber of a company under one header"
          className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium cursor-pointer transition ${
            byCompany
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <span
            className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition ${
              byCompany ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          >
            <span
              className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
                byCompany ? "left-3.5" : "left-0.5"
              }`}
            />
          </span>
          <input type="checkbox" checked={byCompany} className="sr-only"
            onChange={() => setByCompany((v) => !v)} />
          <Building2 className="h-3.5 w-3.5" />
          Group by company
        </label>

        {/* Closed cases are hidden by default; this is how you go back to them. */}
        <button
          onClick={() =>
            setFilters((f) => ({
              ...f, category: f.category === "CLOSED" ? "OPEN" : "CLOSED",
            }))
          }
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
            filters.category === "CLOSED"
              ? "bg-primary text-primary-foreground border-primary"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <Archive className="h-3.5 w-3.5" />
          {filters.category === "CLOSED" ? "Showing closed" : "Closed cases"}
        </button>

        {canEdit && (
          <Button size="sm" className="h-9" onClick={() => setWizardOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> New case
          </Button>
        )}

        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
            showFilters || activeFilters.length
              ? "bg-primary/10 border-primary/40 text-primary"
              : "border-border text-muted-foreground hover:text-foreground"}`}>
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters{activeFilters.length ? ` (${activeFilters.length})` : ""}
        </button>
      </div>

      {/* --- Advanced filters -------------------------------------------- */}
      {showFilters && (
        <div className="rounded-xl border border-border bg-card p-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {([
            ["state", "Status", config?.states.map((s) => [s.code, s.name]) ?? []],
            ["priority", "Priority", config?.priorities.map((p) => [p.code, p.name]) ?? []],
            ["risk", "Risk", [["Low","Low"],["Medium","Medium"],["High","High"],["Critical","Critical"]]],
            ["queue", "Queue", config?.queues.map((q) => [q.code, q.name]) ?? []],
            ["typeCode", "Case type", config?.types.map((t) => [t.code, t.name]) ?? []],
            ["source", "Source", config?.sources.map((s) => [s.code, s.name]) ?? []],
            ["bucket", "DPD bucket", [["Current","Current"],["1-30","1-30"],["31-60","31-60"],
                                      ["61-90","61-90"],["90+","90+"]]],
            ["agentId", "Collector", config?.agents.map((a) => [String(a.id), a.name]) ?? []],
          ] as const).map(([key, label, options]) => (
            <div key={key} className="space-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {label}
              </span>
              <Select
                value={String(filters[key as keyof BoardFilters] ?? "ALL")}
                onValueChange={(v) =>
                  setF(key as keyof BoardFilters, key === "agentId" && v !== "ALL" ? Number(v) : v)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Any" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Any</SelectItem>
                  {(options as [string, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
          <div className="col-span-2 md:col-span-4 lg:col-span-6 flex flex-wrap gap-1.5 pt-1">
            {([
              ["breached", "Past SLA"], ["unassigned", "Unassigned"], ["hasPtp", "Has promise"],
              ["hasDispute", "In dispute"], ["inLegal", "In legal"], ["inAgency", "With agency"],
            ] as const).map(([k, label]) => (
              <button key={k} onClick={() => setF(k, !filters[k])}
                className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                  filters[k] ? "bg-primary text-primary-foreground border-primary"
                             : "border-border text-muted-foreground hover:text-foreground"}`}>
                {label}
              </button>
            ))}
            {["OPEN", "CLOSED"].map((c) => (
              <button key={c} onClick={() => setF("category", filters.category === c ? undefined : c)}
                className={`rounded-lg border px-2 py-1 text-[11px] transition ${
                  filters.category === c ? "bg-primary text-primary-foreground border-primary"
                                         : "border-border text-muted-foreground"}`}>
                {pretty(c)}
              </button>
            ))}
            {activeFilters.length > 0 && (
              <button onClick={() => setFilters({ category: "OPEN" })}
                className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">
                Clear all
              </button>
            )}
          </div>
        </div>
      )}

      {/* --- Bulk bar ----------------------------------------------------- */}
      {picked.size > 0 && canEdit && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex flex-wrap items-center gap-2 sticky top-2 z-20 backdrop-blur">
          <span className="text-sm font-medium text-foreground">{picked.size} selected</span>
          <Select onValueChange={(v) => runBulk("ASSIGN", { agentId: Number(v) })}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Assign to" /></SelectTrigger>
            <SelectContent>
              {config?.agents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk("QUEUE", { queueCode: v })}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Queue" /></SelectTrigger>
            <SelectContent>
              {config?.queues.map((q) => (
                <SelectItem key={q.code} value={q.code}>{q.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk("PRIORITY", { priority: v })}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
            <SelectContent>
              {["Critical", "High", "Medium", "Low"].map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk("ESCALATE",
            { escalateTo: v, reason: "Bulk escalation from the board" })}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Escalate to" /></SelectTrigger>
            <SelectContent>
              {ESCALATION_TARGETS.map(([k, l]) => (
                <SelectItem key={k} value={k}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => runBulk("TAG", { tags: [v] })}>
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              {tags.map((t) => <SelectItem key={t.code} value={t.code}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-xs" disabled={busy}
            onClick={() => runBulk("CLOSE", { reason: "Closed in bulk" })}>
            Close
          </Button>
          <button onClick={() => setPicked(new Set())}
            className="ml-auto text-[11px] text-muted-foreground hover:text-foreground">
            Clear selection
          </button>
        </div>
      )}

      {/* --- Summary ------------------------------------------------------ */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground px-1">
        <span className="font-medium text-foreground">{board?.total ?? 0} tickets</span>
        <span>{money(board?.totalValue ?? 0)} at stake</span>
        <span>
          {board?.columns.length ?? 0}{" "}
          {(byCompany ? "company" : GROUP_LABELS[groupBy]?.toLowerCase())} groups
        </span>
        {view === "LIST" && board && board.columns.length > 1 && (
          <button
            onClick={() =>
              setOpen(open.size ? new Set() : new Set(board.columns.map((c) => c.key)))
            }
            className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          >
            {open.size ? "Collapse all" : "Expand all"}
          </button>
        )}
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
      </div>

      {loading && (
        <div className="py-16 text-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
        </div>
      )}

      {/* --- Kanban ------------------------------------------------------- */}
      {!loading && view === "BOARD" && board && (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {board.columns.map((col) => (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => {
                e.preventDefault();
                const id = Number(e.dataTransfer.getData("text/plain"));
                if (!id) return;
                if (groupBy !== "STATUS") {
                  toast.error("Cards can only be dragged when grouped by status.");
                  setDragOver(null);
                  return;
                }
                if (picked.size > 1 && picked.has(id)) void drop(col.key);
                else void dropOne(id, col.key);
              }}
              className={`w-[300px] shrink-0 flex flex-col rounded-2xl border transition ${
                dragOver === col.key
                  ? "border-primary bg-primary/5"
                  : "border-border bg-muted/20"
              }`}
            >
              <div className="px-3 py-2.5 border-b border-border sticky top-0 bg-muted/40 backdrop-blur rounded-t-2xl">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground truncate"
                        title={col.label}>
                    {col.label}
                  </span>
                  <Pill className="ml-auto">{col.count}</Pill>
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                  {money(col.value)}
                </div>
              </div>
              <div className="p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-22rem)]">
                {col.cards.map((t) => (
                  <TicketCardView
                    key={t.id}
                    t={t}
                    onOpen={onOpenCase}
                    selected={picked.has(t.id)}
                    onToggleSelect={canEdit ? togglePick : undefined}
                    draggable={canEdit && groupBy === "STATUS"}
                  />
                ))}
                {col.count === 0 && (
                  <p className="py-6 text-center text-[11px] text-muted-foreground">Empty</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- Grouped list -------------------------------------------------- */}
      {!loading && view === "LIST" && board && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Customer grouping carries the customer summary card */}
          {(byCompany || groupBy === "CUSTOMER") &&
            board.customerGroups.map((g) => {
              const isOpen = open.has(g.key);
              return (
                <div key={g.key} className="border-b border-border last:border-0">
                  <div onClick={() => toggleGroup(g.key)}
                    className="group px-4 py-3 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {g.customerName}
                        </span>
                        <Pill tone={PRIORITY_TONE[g.worstPriority]}>{g.worstPriority}</Pill>
                        <Pill tone="bg-primary/10 text-primary border-primary/25">
                          {g.cases} {g.cases === 1 ? "ticket" : "tickets"}
                        </Pill>
                        {g.breached > 0 && (
                          <Pill tone="bg-destructive/10 text-destructive border-destructive/25">
                            {g.breached} past SLA
                          </Pill>
                        )}
                        {g.openPtps > 0 && (
                          <Pill tone="bg-sky-500/10 text-sky-600 border-sky-500/25">
                            {g.openPtps} PTP
                          </Pill>
                        )}
                        {g.disputes > 0 && (
                          <Pill tone="bg-orange-500/10 text-orange-600 border-orange-500/25">
                            {g.disputes} dispute
                          </Pill>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {byCompany
                          ? `${g.people} ${g.people === 1 ? "customer" : "customers"} · `
                          : `${g.customerType} · `}
                        {g.accounts} {g.accounts === 1 ? "account" : "accounts"} ·{" "}
                        <span className={RISK_TONE[g.riskLevel] ?? ""}>{g.riskLevel}</span>
                        {g.agentName ? ` · ${g.agentName}` : " · unassigned"}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-semibold tabular-nums text-foreground">
                        {money(g.totalExposure)}
                      </div>
                      <div className="text-[10px] text-muted-foreground">total exposure</div>
                    </div>
                  </div>
                  {isOpen && (
                    <div className="bg-muted/20 border-t border-border p-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {g.tickets.map((t) => (
                        <TicketCardView key={t.id} t={t} onOpen={onOpenCase}
                          selected={picked.has(t.id)}
                          onToggleSelect={canEdit ? togglePick : undefined} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {/* Any other grouping: a collapsible section per group */}
          {!byCompany && groupBy !== "CUSTOMER" &&
            board.columns.map((col) => {
              const isOpen = open.has(col.key);
              return (
                <div key={col.key} className="border-b border-border last:border-0">
                  <div onClick={() => toggleGroup(col.key)}
                    className="px-4 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-muted/40 transition">
                    {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">{pretty(col.key)}</span>
                    <Pill>{col.count}</Pill>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {money(col.value)}
                    </span>
                  </div>
                  {isOpen && (
                    <div className="bg-muted/20 border-t border-border p-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {col.cards.map((t) => (
                        <TicketCardView key={t.id} t={t} onOpen={onOpenCase}
                          selected={picked.has(t.id)}
                          onToggleSelect={canEdit ? togglePick : undefined} />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

          {board.total === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No tickets match these filters.
            </p>
          )}
        </div>
      )}
      <CaseWizard
        open={wizardOpen}
        customer={null}
        config={config}
        onOpenChange={setWizardOpen}
        onCreated={(id) => {
          void load();
          onOpenCase(id);
        }}
      />
    </div>
  );
};
