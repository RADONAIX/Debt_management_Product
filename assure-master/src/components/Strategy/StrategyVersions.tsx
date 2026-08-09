import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight, Check, Copy, GitBranch, History, Loader2, RotateCcw, Search,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ApiError } from "@/lib/api";
import {
  cloneVersion, compareVersion, listStrategies, listVersions, restoreVersion,
  type StrategyRow, type VersionCompare, type VersionRow,
} from "@/lib/strategies";

const KIND_TONE: Record<string, string> = {
  BASELINE: "bg-muted text-muted-foreground border-border",
  EDIT: "bg-info/10 text-info border-info/25",
  RESTORE: "bg-warning/10 text-warning border-warning/25",
  CLONE: "bg-primary/10 text-primary border-primary/25",
};

const KIND_LABEL: Record<string, string> = {
  BASELINE: "Baseline", EDIT: "Edit", RESTORE: "Restored", CLONE: "Copied",
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/25",
  DRAFT: "bg-muted text-muted-foreground border-border",
  PAUSED: "bg-warning/10 text-warning border-warning/25",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

const Pill = ({ tone, children }: { tone?: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium leading-none whitespace-nowrap ${
    tone ?? "bg-muted text-muted-foreground border-border"}`}>
    {children}
  </span>
);

const when = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  const stamp = d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  return days === 0 ? `today · ${stamp}` : days === 1 ? `yesterday · ${stamp}`
       : days < 30 ? `${days} days ago · ${stamp}` : stamp;
};

/**
 * Strategy Versions — what each strategy used to be, and how to get it back.
 *
 * Every edit files the definition it produced, so the list below is the
 * strategy's whole life. From any point in it you can put that definition back
 * as the live one, or start a new strategy from it and leave this one running.
 */
export const StrategyVersions = ({ canEdit = false, onOpenDesigner }: {
  canEdit?: boolean;
  onOpenDesigner?: (code: string) => void;
}) => {
  const [strategies, setStrategies] = useState<StrategyRow[]>([]);
  const [code, setCode] = useState<string>("");
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [selected, setSelected] = useState<VersionRow | null>(null);
  const [diff, setDiff] = useState<VersionCompare | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<VersionRow | null>(null);
  const [cloneOf, setCloneOf] = useState<VersionRow | null>(null);
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");

  const strategy = useMemo(
    () => strategies.find((s) => s.id === code) ?? null, [strategies, code]);

  useEffect(() => {
    listStrategies()
      .then((rows) => {
        setStrategies(rows);
        setCode((c) => c || rows[0]?.id || "");
      })
      .catch(() => toast.error("Could not load the strategies."))
      .finally(() => setLoading(false));
  }, []);

  const load = useCallback(async () => {
    if (!code) return;
    setLoading(true);
    try {
      const rows = await listVersions(code);
      setVersions(rows);
      setSelected(rows[0] ?? null);
    } catch {
      toast.error("Could not load the version history.");
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => { void load(); }, [load]);

  // The live definition is whatever the strategy currently says it is, so the
  // newest version row is only "live" if the numbers agree.
  const liveVersion = strategy?.version;

  useEffect(() => {
    if (!selected || !code) { setDiff(null); return; }
    let cancelled = false;
    compareVersion(code, selected.version)
      .then((c) => !cancelled && setDiff(c))
      .catch(() => !cancelled && setDiff(null));
    return () => { cancelled = true; };
  }, [selected, code, versions]);

  const doRestore = async (v: VersionRow) => {
    setBusy(true);
    try {
      const res = await restoreVersion(code, v.version);
      toast.success(res.detail);
      setConfirmRestore(null);
      setStrategies(await listStrategies());
      await load();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "The restore did not go through.");
    } finally {
      setBusy(false);
    }
  };

  const doClone = async () => {
    if (!cloneOf || !cloneName.trim()) return;
    setBusy(true);
    try {
      const made = await cloneVersion(code, cloneOf.version, {
        name: cloneName.trim(), description: cloneDesc.trim() || undefined,
      });
      toast.success(`${made.id} created as a draft from ${cloneOf.version}.`);
      setCloneOf(null);
      setCloneName("");
      setCloneDesc("");
      setStrategies(await listStrategies());
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not create the strategy.");
    } finally {
      setBusy(false);
    }
  };

  const shown = versions.filter((v) =>
    !search
    || v.version.toLowerCase().includes(search.toLowerCase())
    || (v.summary ?? "").toLowerCase().includes(search.toLowerCase())
    || (v.author ?? "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Strategy Versions"
        description="Every definition a strategy has had, with rollback and branching"
        actions={
          strategy && (
            <div className="flex items-center gap-2">
              <Pill tone={STATUS_TONE[strategy.status.toUpperCase()]}>{strategy.status}</Pill>
              <Pill>Live: {strategy.version}</Pill>
              {onOpenDesigner && (
                <Button variant="outline" size="sm" onClick={() => onOpenDesigner(strategy.id)}>
                  <Workflow className="h-3.5 w-3.5 mr-1.5" /> Open in Designer
                </Button>
              )}
            </div>
          )
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)_320px]">
        {/* Which strategy */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold">Strategies</h3>
            <p className="text-[11px] text-muted-foreground">{strategies.length} in the library</p>
          </div>
          <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {strategies.map((s) => (
              <button
                key={s.id}
                onClick={() => setCode(s.id)}
                className={`w-full text-left px-4 py-2.5 transition ${
                  s.id === code ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-muted/50"}`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium text-foreground truncate">{s.name}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {s.version}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {s.id} · {s.status}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* The history itself */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">
                {strategy?.name ?? "Version history"}
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {versions.length} versions · newest first
              </p>
            </div>
            <div className="ml-auto relative w-44">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Find a version" className="h-8 pl-7 text-xs" />
            </div>
          </div>

          {loading && (
            <div className="py-16 flex justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && shown.length === 0 && (
            <p className="px-4 py-12 text-center text-xs text-muted-foreground">
              No versions recorded yet. The next edit to this strategy will file one.
            </p>
          )}

          <div className="divide-y divide-border max-h-[560px] overflow-y-auto">
            {!loading && shown.map((v) => {
              const isLive = v.version === liveVersion;
              const isSelected = selected?.version === v.version;
              return (
                <div
                  key={v.id}
                  onClick={() => setSelected(v)}
                  className={`px-4 py-3 cursor-pointer transition ${
                    isSelected ? "bg-primary/5" : "hover:bg-muted/40"}`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold tabular-nums">{v.version}</span>
                    {isLive && (
                      <Pill tone="bg-success/10 text-success border-success/25">
                        <Check className="h-3 w-3 mr-0.5" /> Live
                      </Pill>
                    )}
                    <Pill tone={KIND_TONE[v.kind]}>{KIND_LABEL[v.kind] ?? v.kind}</Pill>
                    {v.restoredFrom && <Pill>from {v.restoredFrom}</Pill>}
                    <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                      {when(v.createdAt)}
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1">{v.summary}</p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {v.author ?? "unknown author"}
                    </span>
                    {v.nodes > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        · {v.nodes} steps, {v.edges} links
                      </span>
                    )}
                    {v.changedFields.slice(0, 3).map((f) => (
                      <span key={f}
                            className="rounded px-1.5 py-0.5 text-[9px] bg-muted text-muted-foreground">
                        {f}
                      </span>
                    ))}
                    {v.changedFields.length > 3 && (
                      <span className="text-[9px] text-muted-foreground">
                        +{v.changedFields.length - 3}
                      </span>
                    )}
                  </div>

                  {isSelected && canEdit && (
                    <div className="flex gap-2 mt-2.5">
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        disabled={isLive || v.nodes === 0}
                        title={isLive ? "This is already the live definition"
                               : v.nodes === 0 ? "This release predates version history, so there is nothing to restore"
                               : undefined}
                        onClick={(e) => { e.stopPropagation(); setConfirmRestore(v); }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1.5" /> Restore this version
                      </Button>
                      <Button
                        size="sm" variant="outline" className="h-7 text-xs"
                        disabled={v.nodes === 0}
                        title={v.nodes === 0 ? "This release predates version history, so there is nothing to copy" : undefined}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCloneOf(v);
                          setCloneName(`${strategy?.name ?? "Strategy"} (from ${v.version})`);
                        }}
                      >
                        <Copy className="h-3 w-3 mr-1.5" /> New strategy from this
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* What is different about the selected version */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-1.5">
              <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
              <h3 className="text-sm font-semibold">Against what is live</h3>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {diff ? `${diff.left} vs ${diff.right}` : "Pick a version"}
            </p>
          </div>

          {diff && diff.differences.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              Identical to the live definition — restoring it would change nothing.
            </p>
          )}

          <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
            {diff?.differences.map((f) => (
              <div key={f.field} className="px-4 py-2.5">
                <div className="text-[11px] font-medium text-foreground">{f.field}</div>
                <div className="mt-1 space-y-1">
                  <div className="rounded-md bg-warning/5 border border-warning/20 px-2 py-1">
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      this version
                    </span>
                    <p className="text-[11px] text-foreground break-words">{f.before}</p>
                  </div>
                  <div className="rounded-md bg-success/5 border border-success/20 px-2 py-1">
                    <span className="text-[9px] uppercase tracking-wide text-muted-foreground">
                      live now
                    </span>
                    <p className="text-[11px] text-foreground break-words">{f.after}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && selected.nodes === 0 && (
            <p className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground">
              This release was recorded before version history began, so only its number was
              kept. Versions filed from now on hold the full definition.
            </p>
          )}
        </div>
      </div>

      {/* Restore */}
      <Dialog open={!!confirmRestore} onOpenChange={(o) => !o && setConfirmRestore(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="h-4 w-4" />
              Restore {confirmRestore?.version}?
            </DialogTitle>
            <DialogDescription>
              {strategy?.name} goes back to its {confirmRestore?.version} definition. The version
              it replaces stays in the history, so this can be undone by restoring that one.
            </DialogDescription>
          </DialogHeader>
          {diff && diff.differences.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/30 p-3 max-h-48 overflow-y-auto">
              <p className="text-[11px] text-muted-foreground mb-1.5">
                {diff.differences.length}{" "}
                {diff.differences.length === 1 ? "field changes" : "fields change"}:
              </p>
              <ul className="space-y-1">
                {diff.differences.map((f) => (
                  <li key={f.field} className="text-[11px] text-foreground">
                    <span className="font-medium">{f.field}</span>{" "}
                    <span className="text-muted-foreground">
                      {f.after} → {f.before}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            The strategy stays {strategy?.status.toLowerCase()} — restoring a definition does not
            start or stop it.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button disabled={busy}
                    onClick={() => confirmRestore && void doRestore(confirmRestore)}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Restore {confirmRestore?.version}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Branch into a new strategy */}
      <Dialog open={!!cloneOf} onOpenChange={(o) => !o && setCloneOf(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              New strategy from {cloneOf?.version}
            </DialogTitle>
            <DialogDescription>
              Copies the {cloneOf?.version} definition of {strategy?.name} into a new strategy.
              {" "}{strategy?.name} keeps running exactly as it is.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input value={cloneName} onChange={(e) => setCloneName(e.target.value)}
                     placeholder="What is this new strategy called?" className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description <span className="text-muted-foreground">(optional)</span></Label>
              <Textarea rows={2} value={cloneDesc} onChange={(e) => setCloneDesc(e.target.value)}
                        placeholder="Why is it being branched off?" />
            </div>
            <p className="text-[11px] text-muted-foreground">
              It starts as a Draft with its own version history at v1.0 — an old definition under a
              new name has not been reviewed by anyone yet.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloneOf(null)}>Cancel</Button>
            <Button disabled={busy || !cloneName.trim()} onClick={() => void doClone()}>
              {busy && <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />}
              Create strategy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrategyVersions;
