import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
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
import { MultiSelect } from "@/components/ui/multi-select";
import { ApiError } from "@/lib/api";
import {
  AGENCY_STATUSES,
  AGENCY_TYPES,
  createAgency,
  updateAgency,
  type Agency,
  type AgencyWrite,
} from "@/lib/recovery";
import { pretty } from "./shared";

const RISKS = ["Low", "Medium", "High", "Critical"];
const BUCKETS = ["Current", "1-30", "31-60", "61-90", "90+"];

const EMPTY: AgencyWrite = {
  name: "",
  type: "Consumer Debt",
  status: "ACTIVE",
  commissionPct: 15,
  recallDays: 90,
  capacity: 250,
  minPlacement: 0,
  maxPlacement: null,
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  city: "",
  country: "",
  coversRisk: [],
  coversBucket: [],
  contractEnd: null,
  notes: "",
};

/** Register a new agency or edit an existing contract. */
export const AgencyDialog = ({
  open,
  agency,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null registers a new agency. */
  agency: Agency | null;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
}) => {
  const [form, setForm] = useState<AgencyWrite>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(
      agency
        ? {
            name: agency.name,
            type: agency.type,
            status: agency.status,
            commissionPct: agency.commissionPct,
            recallDays: agency.recallDays,
            capacity: agency.capacity,
            minPlacement: agency.minPlacement,
            maxPlacement: agency.maxPlacement ?? null,
            contactName: agency.contactName ?? "",
            contactEmail: agency.contactEmail ?? "",
            contactPhone: agency.contactPhone ?? "",
            city: agency.city ?? "",
            country: agency.country ?? "",
            coversRisk: agency.coversRisk,
            coversBucket: agency.coversBucket,
            contractEnd: agency.contractEnd ?? null,
            notes: agency.notes ?? "",
          }
        : EMPTY,
    );
  }, [open, agency]);

  const set = (patch: Partial<AgencyWrite>) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("The agency needs a name.");
      return;
    }
    setSaving(true);
    try {
      if (agency) await updateAgency(agency.id, form);
      else await createAgency(form);
      toast.success(agency ? "Agency updated." : "Agency registered.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not save the agency.");
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, node: React.ReactNode) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {node}
    </div>
  );

  const num = (label: string, value: number | null | undefined, on: (v: number | null) => void, ph?: string) =>
    field(
      label,
      <Input
        type="number"
        className="h-9"
        placeholder={ph}
        value={value ?? ""}
        onChange={(e) => on(e.target.value === "" ? null : Number(e.target.value))}
      />,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{agency ? `Edit ${agency.name}` : "Register an agency"}</DialogTitle>
          <DialogDescription>
            The contract terms here govern what may be placed and when it can be recalled.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            {field(
              "Agency name",
              <Input className="h-9" value={form.name} onChange={(e) => set({ name: e.target.value })} />,
            )}
            {field(
              "Specialisation",
              <Select value={form.type} onValueChange={(v) => set({ type: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
          </div>

          <div className="grid grid-cols-4 gap-3">
            {field(
              "Status",
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENCY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {pretty(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>,
            )}
            {num("Commission %", form.commissionPct, (v) => set({ commissionPct: v ?? 0 }))}
            {num("Recall window (days)", form.recallDays, (v) => set({ recallDays: v ?? 90 }))}
            {num("Capacity", form.capacity, (v) => set({ capacity: v ?? 0 }))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {num("Minimum placement ($)", form.minPlacement, (v) => set({ minPlacement: v ?? 0 }), "0")}
            {num("Maximum placement ($)", form.maxPlacement, (v) => set({ maxPlacement: v }), "No limit")}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {field(
              "Covers risk bands",
              <MultiSelect
                options={RISKS}
                value={form.coversRisk}
                onChange={(v) => set({ coversRisk: v })}
              />,
            )}
            {field(
              "Covers DPD buckets",
              <MultiSelect
                options={BUCKETS}
                value={form.coversBucket}
                onChange={(v) => set({ coversBucket: v })}
              />,
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {field(
              "Contact name",
              <Input
                className="h-9"
                value={form.contactName ?? ""}
                onChange={(e) => set({ contactName: e.target.value })}
              />,
            )}
            {field(
              "Email",
              <Input
                className="h-9"
                value={form.contactEmail ?? ""}
                onChange={(e) => set({ contactEmail: e.target.value })}
              />,
            )}
            {field(
              "Phone",
              <Input
                className="h-9"
                value={form.contactPhone ?? ""}
                onChange={(e) => set({ contactPhone: e.target.value })}
              />,
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {field(
              "City",
              <Input className="h-9" value={form.city ?? ""} onChange={(e) => set({ city: e.target.value })} />,
            )}
            {field(
              "Country",
              <Input
                className="h-9"
                value={form.country ?? ""}
                onChange={(e) => set({ country: e.target.value })}
              />,
            )}
            {field(
              "Contract ends",
              <Input
                type="date"
                className="h-9"
                value={form.contractEnd ?? ""}
                onChange={(e) => set({ contractEnd: e.target.value || null })}
              />,
            )}
          </div>

          {field(
            "Notes",
            <Textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Anything the team should know before placing with them."
            />,
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {agency ? "Save changes" : "Register agency"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
