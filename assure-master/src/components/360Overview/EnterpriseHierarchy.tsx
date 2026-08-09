import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, ChevronDown, ChevronRight, Loader2, MapPin, Users } from "lucide-react";
import { getCompany, type CompanyDetail, type SubscriberRow } from "@/lib/customers";
import { money } from "@/lib/money";

const riskTone: Record<string, string> = {
  Low: "bg-success/10 text-success border-success/20",
  Medium: "bg-warning/10 text-warning border-warning/20",
  High: "bg-destructive/10 text-destructive border-destructive/20",
  Critical: "bg-destructive/20 text-destructive border-destructive/30",
};

/**
 * Company → branch → subscriber explorer for enterprise accounts. Selecting a
 * subscriber loads them into the 360 view above.
 */
export const EnterpriseHierarchy = ({
  companyCode,
  onSelectSubscriber,
  activeCustomerId,
}: {
  /** Company of the selected subscriber. Consumers pass null and nothing renders. */
  companyCode?: string | null;
  onSelectSubscriber?: (subscriber: SubscriberRow, companyName: string) => void;
  activeCustomerId?: string;
}) => {
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [openBranches, setOpenBranches] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyCode) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getCompany(companyCode)
      .then((d) => {
        if (cancelled) return;
        setDetail(d);
        // Open the head office by default so the list is never empty.
        setOpenBranches(new Set(d.branchList.slice(0, 1).map((b) => b.id)));
      })
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [companyCode]);

  const toggleBranch = (id: string) =>
    setOpenBranches((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  if (!companyCode || !detail) return null;

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          {detail.name}
          <span className="font-normal text-muted-foreground">
            · {detail.branches} branch{detail.branches === 1 ? "" : "es"} · {detail.subscribers}{" "}
            subscribers · {money(detail.outstanding)} due
          </span>
        </h3>
        {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      <div>
        {/* Branches and their subscribers */}
        <div className="space-y-3">
          {detail && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-1">
              {detail.industry && <span>{detail.industry}</span>}
              {detail.hqCity && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {detail.hqCity}
                </span>
              )}
              <span className="ml-auto flex flex-wrap gap-1">
                {detail.bans.map((b) => (
                  <Badge key={b} variant="outline" className="text-[10px]">
                    {b}
                  </Badge>
                ))}
              </span>
            </div>
          )}

          {detail?.branchList.map((b) => {
            const open = openBranches.has(b.id);
            return (
              <div key={b.id} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleBranch(b.id)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  {open ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm font-medium text-foreground">{b.name}</span>
                  {b.isHeadOffice && (
                    <Badge variant="outline" className="text-[10px]">
                      Head office
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground">{b.city}</span>
                  <span className="ml-auto text-xs text-muted-foreground flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {b.subscribers}
                    </span>
                    <span className="font-medium text-foreground">{money(b.outstanding)}</span>
                  </span>
                </button>

                {open && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-2 font-semibold">Subscriber</th>
                          <th className="px-4 py-2 font-semibold">Number</th>
                          <th className="px-4 py-2 font-semibold">Service</th>
                          <th className="px-4 py-2 font-semibold">BAN</th>
                          <th className="px-4 py-2 font-semibold text-right">Outstanding</th>
                          <th className="px-4 py-2 font-semibold text-right">DPD</th>
                          <th className="px-4 py-2 font-semibold">Risk</th>
                        </tr>
                      </thead>
                      <tbody>
                        {b.subscriberList.map((s) => (
                          <tr
                            key={s.id}
                            onClick={() => onSelectSubscriber?.(s, detail.name)}
                            className={`border-t border-border cursor-pointer hover:bg-muted/40 ${
                              s.id === activeCustomerId ? "bg-primary/5" : ""
                            }`}
                          >
                            <td className="px-4 py-2 font-medium text-foreground">{s.name}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.subscriberNo}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.servicePlan}</td>
                            <td className="px-4 py-2 text-muted-foreground">{s.ban}</td>
                            <td className="px-4 py-2 text-right">{money(s.outstanding)}</td>
                            <td className="px-4 py-2 text-right">{s.dpd}</td>
                            <td className="px-4 py-2">
                              <Badge
                                variant="outline"
                                className={riskTone[s.riskLevel] ?? ""}
                              >
                                {s.riskLevel}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                        {b.subscriberList.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-4 py-6 text-center text-muted-foreground">
                              No subscribers on this branch.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
};
