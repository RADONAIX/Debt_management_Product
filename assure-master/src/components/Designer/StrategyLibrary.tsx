import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Download, Copy, Edit, X } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  listStrategies,
  createStrategy,
  deleteStrategy,
  setStrategyActive,
  AGING_BUCKETS,
  RISK_LEVELS,
  type StrategyRow,
} from "@/lib/strategies";
import { hasPermission } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Trash2, Loader2 } from "lucide-react";

interface Strategy {
  id: string;
  name: string;
  segment: string;
  aging: string;
  status: "Active" | "Draft";
  customers: number;
  uplift: string;
  version: string;
  lastModified: string;
  contactability?: number;
  ptpGiven?: number;
  collectionsOff?: string;
  riskRange?: string;
  channelsUsed?: string[];
  totalAccounts?: number;
  ptpHonored?: string;
  aiPrediction?: string;
  confidence?: number;
}

export /** Stable per-template pseudo-value, so figures don't change between renders. */
const seedOf = (id: string) => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 9973, 7);

interface StrategyLibraryProps {
  onOpenStrategy: (id: string) => void;
  /** The "New Strategy" button lives in the page header, which the parent owns. */
  newOpen?: boolean;
  onNewOpenChange?: (open: boolean) => void;
}

const emptyDraft = { name: "", segment: "Consumer", aging: "1-30", riskLevel: "Medium" };

/** The API takes multi-select fields as arrays. */
const asList = (v: string) => (v ? [v] : undefined);

const StrategyLibrary = ({
  onOpenStrategy,
  newOpen = false,
  onNewOpenChange,
}: StrategyLibraryProps) => {
  const canEdit = hasPermission("dunningStrategyDesigner", "edit");
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Strategy | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentFilter, setSegmentFilter] = useState("all");
  const [agingFilter, setAgingFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelsFilter, setChannelsFilter] = useState("all");

  // Search counts as a filter so "Clear" always undoes everything visible.
  const activeFilterCount = [
    segmentFilter,
    agingFilter,
    riskFilter,
    statusFilter,
    channelsFilter,
  ].filter((v) => v !== "all").length + (searchQuery.trim() ? 1 : 0);

  const clearFilters = () => {
    setSegmentFilter("all");
    setAgingFilter("all");
    setRiskFilter("all");
    setStatusFilter("all");
    setChannelsFilter("all");
    setSearchQuery("");
  };

  const [strategies, setStrategies] = useState<Strategy[]>([]);

  /** Panel figures the API does not yet compute stay derived, as before. */
  const decorate = (s: StrategyRow): Strategy => ({
    id: s.id,
    name: s.name,
    segment: s.segment ?? "—",
    aging: (s.aging ?? []).join(", ") || "—",
    status: s.status as Strategy["status"],
    customers: 0,
    uplift: s.uplift != null ? `${s.uplift}%` : "—",
    version: s.version,
    lastModified: new Date(s.updatedAt).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
    }),
    contactability: 60 + (seedOf(s.id) % 30),
    ptpGiven: 25 + (seedOf(s.id) % 20),
    collectionsOff: `+${(5 + (seedOf(s.id) % 150) / 10).toFixed(1)}%`,
    riskRange: (s.riskLevel ?? []).join(", ") || "—",
    channelsUsed: ["SMS", "Email", "WA", "Dialer"],
    totalAccounts: 0,
    ptpHonored: `+${(2 + (seedOf(s.id) % 50) / 10).toFixed(1)}%`,
    aiPrediction: `$ ${(10 + (seedOf(s.id) % 200) / 10).toFixed(1)}M expected in 30 days`,
    confidence: 75 + (seedOf(s.id) % 20),
  });

  const reload = async () => {
    setLoading(true);
    try {
      const rows = await listStrategies();
      setStrategies(rows.map(decorate));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Failed to load strategies");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveNew = async () => {
    setSaving(true);
    try {
      const created = await createStrategy({
        name: draft.name,
        segment: draft.segment,
        aging: asList(draft.aging),
        riskLevel: asList(draft.riskLevel),
        status: "Draft",
      });
      toast.success(`${created.name} created`);
      onNewOpenChange?.(false);
      setDraft(emptyDraft);
      await reload();
      onOpenStrategy(created.id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not create the strategy");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: Strategy) => {
    try {
      const next = s.status !== "Active";
      await setStrategyActive(s.id, next);
      toast.success(next ? "Strategy activated" : "Strategy paused");
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Action failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteStrategy(deleteTarget.id);
      toast.success("Strategy deleted");
      setDeleteTarget(null);
      await reload();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Delete failed");
    }
  };

  const filteredStrategies = strategies.filter((strategy) => {
    const matchesSearch = strategy.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (strategy.segment ?? "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSegment = segmentFilter === "all" || (strategy.segment ?? "").toLowerCase().includes(segmentFilter.toLowerCase());
    const matchesAging = agingFilter === "all" || (strategy.aging ?? "").includes(agingFilter);
    const matchesRisk = riskFilter === "all" || strategy.riskRange?.toLowerCase().includes(riskFilter.toLowerCase());
    const matchesStatus = statusFilter === "all" || strategy.status === statusFilter;
    const matchesChannels = channelsFilter === "all" || 
      strategy.channelsUsed?.some(channel => channel === channelsFilter);

    return matchesSearch && matchesSegment && matchesAging && matchesRisk && matchesStatus && matchesChannels;
  });

  return (
    <div className="bg-background">
      
      <div className="p-6">


        {/* Filter Bar */}
        <div className="mb-6 flex flex-wrap gap-3 items-center">
          <Select value={segmentFilter} onValueChange={setSegmentFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Segment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Segments</SelectItem>
              <SelectItem value="Enterprise">Enterprise</SelectItem>
              <SelectItem value="Consumer">Consumer</SelectItem>
              <SelectItem value="SMB">SMB</SelectItem>
              <SelectItem value="Government">Government</SelectItem>
            </SelectContent>
          </Select>

          <Select value={agingFilter} onValueChange={setAgingFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Aging Bucket" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Aging</SelectItem>
              <SelectItem value="0-30">0-30 days</SelectItem>
              <SelectItem value="11-30">11-30 days</SelectItem>
              <SelectItem value="31-60">31-60 days</SelectItem>
              <SelectItem value="61-90">61-90 days</SelectItem>
              <SelectItem value="90+">90+ days</SelectItem>
            </SelectContent>
          </Select>

          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Risk" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Risk</SelectItem>
              <SelectItem value="Low">Low</SelectItem>
              <SelectItem value="Medium">Medium</SelectItem>
              <SelectItem value="High">High</SelectItem>
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Draft">Draft</SelectItem>
            </SelectContent>
          </Select>

          <Select value={channelsFilter} onValueChange={setChannelsFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Channels" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Channels</SelectItem>
              <SelectItem value="SMS">SMS</SelectItem>
              <SelectItem value="Email">Email</SelectItem>
              <SelectItem value="WA">WhatsApp</SelectItem>
              <SelectItem value="Dialer">Dialer</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-56">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search strategies..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-xs text-muted-foreground tabular-nums">
                {filteredStrategies.length} of {strategies.length} strategies
              </span>
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 gap-1.5">
                <X className="h-3.5 w-3.5" />
                Clear {activeFilterCount === 1 ? "filter" : `${activeFilterCount} filters`}
              </Button>
            </div>
          )}
        </div>

        {/* Strategy Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Strategy Name</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Aging</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Customers</TableHead>
                <TableHead>Uplift</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Last Modified</TableHead>
                {canEdit && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStrategies.map((strategy) => (
                <TableRow 
                  key={strategy.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onOpenStrategy(strategy.id)}
                >
                  <TableCell className="font-medium">{strategy.name}</TableCell>
                  <TableCell>{strategy.segment}</TableCell>
                  <TableCell>{strategy.aging}</TableCell>
                  <TableCell>
                    <Badge variant={strategy.status === "Active" ? "default" : "secondary"}>
                      {strategy.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{strategy.customers.toLocaleString()}</TableCell>
                  <TableCell>{strategy.uplift}</TableCell>
                  <TableCell>{strategy.version}</TableCell>
                  <TableCell>{strategy.lastModified}</TableCell>
                  {canEdit && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => toggleActive(strategy)}
                          title={strategy.status === "Active" ? "Pause" : "Activate"}
                          className={`h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center ${
                            strategy.status === "Active" ? "text-warning" : "text-success"
                          }`}
                        >
                          {strategy.status === "Active" ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => onOpenStrategy(strategy.id)}
                          title="Edit in designer"
                          className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(strategy)}
                          title="Delete strategy"
                          className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {!loading && filteredStrategies.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 9 : 8} className="py-10 text-center text-muted-foreground">
                    No strategies match your filters.
                  </TableCell>
                </TableRow>
              )}
              {loading && (
                <TableRow>
                  <TableCell colSpan={canEdit ? 9 : 8} className="py-10 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

      </div>
      {/* New strategy */}
      <Dialog open={newOpen} onOpenChange={(o) => onNewOpenChange?.(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New strategy</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                placeholder="e.g. Soft Reminder Journey"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Segment</Label>
              <Input
                value={draft.segment}
                onChange={(e) => setDraft({ ...draft, segment: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Aging bucket</Label>
                <Select
                  value={draft.aging}
                  onValueChange={(v) => setDraft({ ...draft, aging: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AGING_BUCKETS.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Risk level</Label>
                <Select
                  value={draft.riskLevel}
                  onValueChange={(v) => setDraft({ ...draft, riskLevel: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RISK_LEVELS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Created as a draft — activate it once the journey is built.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onNewOpenChange?.(false)}>
              Cancel
            </Button>
            <Button onClick={saveNew} disabled={saving || !draft.name.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create strategy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete strategy</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <b>{deleteTarget?.name}</b> and its version history.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default StrategyLibrary;
