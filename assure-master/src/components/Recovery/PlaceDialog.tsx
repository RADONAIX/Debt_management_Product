import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/money";
import { ApiError } from "@/lib/api";
import {
  createPlacement,
  getEligible,
  PRIORITIES,
  type Agency,
  type EligibleAccount,
} from "@/lib/recovery";
import { Pill, RISK_TONE } from "./shared";

/**
 * Place a delinquent account with an agency. The eligible list is the live
 * book minus anything already out with an agency, so the same account can
 * never be placed twice.
 */
export const PlaceDialog = ({
  open,
  agencies,
  onOpenChange,
  onPlaced,
}: {
  open: boolean;
  agencies: Agency[];
  onOpenChange: (v: boolean) => void;
  onPlaced: () => void;
}) => {
  const [accounts, setAccounts] = useState<EligibleAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<EligibleAccount | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [amount, setAmount] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPicked(null);
    setSearch("");
    setAmount("");
    setNotes("");
    setLoading(true);
    getEligible()
      .then(setAccounts)
      .catch(() => toast.error("Could not load eligible accounts."))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return accounts;
    return accounts.filter(
      (a) =>
        a.customerName.toLowerCase().includes(q) ||
        a.accountCode.toLowerCase().includes(q) ||
        a.customerId.toLowerCase().includes(q),
    );
  }, [accounts, search]);

  const agency = agencies.find((a) => a.id === agencyId);
  const amountNum = Number(amount || 0);

  // Warn before the server rejects it — the contract terms are known here.
  const breach = useMemo(() => {
    if (!agency || !amountNum) return null;
    if (amountNum < agency.minPlacement)
      return `${agency.name} has a minimum placement of ${money(agency.minPlacement)}.`;
    if (agency.maxPlacement != null && amountNum > agency.maxPlacement)
      return `${agency.name} has a maximum placement of ${money(agency.maxPlacement)}.`;
    if (agency.activePlacements >= agency.capacity) return `${agency.name} is at capacity.`;
    if (picked && agency.coversRisk.length && !agency.coversRisk.includes(picked.riskLevel))
      return `${agency.name} does not normally work ${picked.riskLevel} risk accounts.`;
    return null;
  }, [agency, amountNum, picked]);

  const submit = async () => {
    if (!picked || !agencyId) return;
    setSaving(true);
    try {
      await createPlacement({
        agencyId,
        customerId: picked.customerId,
        accountId: picked.accountId,
        placedAmount: amountNum || picked.outstanding,
        priority,
        notes: notes || undefined,
      });
      toast.success(`${picked.customerName} placed with ${agency?.name}.`);
      onPlaced();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not place that account.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[88vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Place an account with an agency</DialogTitle>
          <DialogDescription>
            Only delinquent accounts that are not already with an agency appear here.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-5 gap-4 flex-1 min-h-0">
          {/* Account picker */}
          <div className="col-span-3 flex flex-col min-h-0">
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="h-9 pl-8 text-sm"
                placeholder="Search by customer, account or code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex-1 overflow-y-auto rounded-xl border border-border divide-y divide-border min-h-[320px]">
              {loading && (
                <div className="p-8 text-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                </div>
              )}
              {!loading &&
                filtered.map((a) => (
                  <button
                    key={a.accountId}
                    onClick={() => {
                      setPicked(a);
                      setAmount(String(a.outstanding));
                      setPriority(a.dpd >= 120 ? "Critical" : a.dpd >= 90 ? "High" : "Medium");
                    }}
                    className={`w-full text-left px-3 py-2.5 transition ${
                      picked?.accountId === a.accountId ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate flex-1">
                        {a.customerName}
                      </span>
                      <span className="text-sm font-semibold tabular-nums">
                        {money(a.outstanding)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
                      <span className="font-mono">{a.accountCode}</span>
                      <span>·</span>
                      <span>{a.customerType}</span>
                      <span>·</span>
                      <span>{a.dpd} DPD</span>
                      <span className={`ml-auto font-medium ${RISK_TONE[a.riskLevel] ?? ""}`}>
                        {a.riskLevel}
                      </span>
                    </div>
                  </button>
                ))}
              {!loading && filtered.length === 0 && (
                <p className="p-8 text-center text-xs text-muted-foreground">
                  No eligible accounts match that search.
                </p>
              )}
            </div>
          </div>

          {/* Placement terms */}
          <div className="col-span-2 space-y-3">
            <div className="rounded-xl border border-border p-3 bg-muted/20 min-h-[64px]">
              {picked ? (
                <>
                  <div className="text-sm font-semibold text-foreground truncate">
                    {picked.customerName}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {picked.accountCode} · {picked.agingBucket} · {picked.dpd} DPD
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Choose an account to place.</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Agency</Label>
              <Select value={agencyId} onValueChange={setAgencyId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Choose an agency" />
                </SelectTrigger>
                <SelectContent>
                  {agencies
                    .filter((a) => a.status === "ACTIVE")
                    .map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} · {a.commissionPct}%
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              {agency && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  <Pill>{agency.recoveryRate}% recovery</Pill>
                  <Pill>
                    {agency.activePlacements}/{agency.capacity} used
                  </Pill>
                  <Pill>{agency.recallDays}d recall</Pill>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount to place</Label>
              <Input
                type="number"
                className="h-9"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Textarea
              rows={2}
              placeholder="Handover notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />

            {breach && (
              <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-2.5">
                <TriangleAlert className="h-3.5 w-3.5 text-warning mt-0.5 shrink-0" />
                <p className="text-[11px] text-warning-foreground/90">{breach}</p>
              </div>
            )}

            {agency && amountNum > 0 && (
              <p className="text-[11px] text-muted-foreground">
                Full recovery would earn {agency.name}{" "}
                <span className="font-semibold text-foreground">
                  {money((amountNum * agency.commissionPct) / 100)}
                </span>{" "}
                in commission.
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={saving || !picked || !agencyId || amountNum <= 0}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Place {amountNum ? money(amountNum) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
