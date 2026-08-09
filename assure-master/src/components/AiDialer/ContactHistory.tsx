import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, Bot, Clock, Loader2, Mail, MessageCircle,
  MessageSquare, Phone, PhoneOff, RefreshCw, Search, Users,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  getContactHistory, getContactOptions, getContactSummary,
  type ContactOptions, type ContactRow, type ContactSummary,
} from "@/lib/engagement";

const PAGE = 25;

const CHANNEL_ICON: Record<string, typeof Phone> = {
  Dialer: Phone, CALL: Phone, IVR: Phone, Voicebot: Bot, VOICEBOT: Bot,
  SMS: MessageSquare, WhatsApp: MessageCircle, WHATSAPP: MessageCircle,
  Email: Mail, EMAIL: Mail, CHAT: MessageCircle,
};

/** One colour per channel, shared by the chart and the rows. */
const CHANNEL_FILL: Record<string, string> = {
  Dialer: "hsl(var(--primary))",
  SMS: "hsl(var(--info))",
  Email: "hsl(var(--warning))",
  WhatsApp: "hsl(var(--success))",
  IVR: "hsl(var(--muted-foreground))",
  Voicebot: "hsl(var(--destructive))",
};

/** How an attempt ended, in the three states the data actually distinguishes. */
const outcomeTone = (outcome?: string | null) => {
  if (!outcome) return "bg-muted text-muted-foreground border-border";
  const o = outcome.toUpperCase();
  if (o.startsWith("NO") && o.includes("ANSWER")) {
    return "bg-destructive/10 text-destructive border-destructive/25";
  }
  if (["DELIVERED", "OPENED", "READ", "SENT"].includes(o) || o.startsWith("REMINDER SENT")) {
    return "bg-muted text-muted-foreground border-border";
  }
  if (o.includes("PROMISE")) return "bg-success/10 text-success border-success/25";
  return "bg-info/10 text-info border-info/25";
};

const pct = (v?: number | null) => (v == null ? "—" : `${v}%`);

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" })
       + ` ${d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}`;
};

const Pill = ({ tone, children }: { tone?: string; children: React.ReactNode }) => (
  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none whitespace-nowrap ${
    tone ?? "bg-muted text-muted-foreground border-border"}`}>
    {children}
  </span>
);

const Kpi = ({ icon: Icon, label, value, sub, tone = "" }: {
  icon: typeof Phone; label: string; value: string; sub: string; tone?: string;
}) => (
  <Card className="p-4">
    <div className="flex items-center gap-2">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground truncate">
        {label}
      </span>
      <Icon className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
    </div>
    <div className={`text-2xl font-semibold tabular-nums leading-tight mt-1 ${tone}`}>
      {value}
    </div>
    <div className="text-[11px] text-muted-foreground">{sub}</div>
  </Card>
);

const Panel = ({ title, hint, right, children }: {
  title: string; hint?: string; right?: React.ReactNode; children: React.ReactNode;
}) => (
  <Card className="overflow-hidden">
    <div className="px-4 py-3 border-b border-border flex items-center gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground truncate">{title}</h3>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </div>
      {right && <div className="ml-auto shrink-0">{right}</div>}
    </div>
    {children}
  </Card>
);

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
    borderRadius: "0.75rem", fontSize: "12px",
  },
  labelStyle: { color: "hsl(var(--muted-foreground))", fontSize: "11px" },
};

/**
 * Contact history — every conversation the desk has had, on any channel.
 *
 * Replaces the two tabs that were a grid of hardcoded numbers and a set of
 * literal chart arrays. Everything here is read from the activity the rest of
 * the product already writes: calls, SMS, email, WhatsApp, IVR and voicebot.
 *
 * It answers what an engagement desk asks — what was attempted, on which
 * channel, whether anybody was reached and when they pick up. Balances and
 * recovery belong to the collections screens, so nothing here repeats them.
 */
export const ContactHistory = ({ canSeeFloor = true }: { canSeeFloor?: boolean }) => {
  const [d, setD] = useState<ContactSummary | null>(null);
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [options, setOptions] = useState<ContactOptions | null>(null);
  const [days, setDays] = useState("30");
  const [agentId, setAgentId] = useState("all");
  const [channel, setChannel] = useState("all");
  const [direction, setDirection] = useState("all");
  const [reached, setReached] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const filters = useMemo(() => ({
    days: Number(days),
    agentId: agentId === "all" ? undefined : Number(agentId),
    channel: channel === "all" ? undefined : channel,
    direction: direction === "all" ? undefined : direction,
    reached: reached === "all" ? undefined : reached === "yes",
    search: search.trim() || undefined,
  }), [days, agentId, channel, direction, reached, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, h] = await Promise.all([
        getContactSummary({ days: filters.days, agentId: filters.agentId }),
        getContactHistory({ ...filters, limit: PAGE, offset: page * PAGE }),
      ]);
      setD(s);
      setRows(h);
    } catch {
      toast.error("Could not load the contact history.");
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { getContactOptions().then(setOptions).catch(() => undefined); }, []);
  // A new filter starts at the first page; page 3 of a list you have not seen
  // yet is disorienting.
  useEffect(() => { setPage(0); }, [days, agentId, channel, direction, reached, search]);

  const dayChart = useMemo(
    () => (d?.byDay ?? []).map((x) => ({
      ...x,
      label: new Date(x.day).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
    })), [d]);

  const hourChart = useMemo(
    () => (d?.byHour ?? []).map((h) => ({
      ...h,
      label: `${String(h.hour).padStart(2, "0")}:00`,
    })), [d]);

  const bestHour = useMemo(() => {
    const worth = (d?.byHour ?? []).filter((h) => h.attempts >= 3 && h.reachRate != null);
    return worth.sort((a, b) => (b.reachRate ?? 0) - (a.reachRate ?? 0))[0];
  }, [d]);

  const clearAll = () => {
    setChannel("all"); setDirection("all"); setReached("all"); setSearch("");
    setAgentId("all");
  };
  const filtered = channel !== "all" || direction !== "all" || reached !== "all"
                || search.trim() !== "" || agentId !== "all";

  if (loading && !d) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!d) return null;

  return (
    <div className="space-y-4">
      {/* Scope */}
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="h-9 w-[150px] text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"],
              ["180", "Last 6 months"]].map(([v, l]) => (
              <SelectItem key={v} value={v}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {canSeeFloor && (
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Everyone" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Everyone</SelectItem>
              {options?.agents.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" className="h-9 ml-auto"
                onClick={() => void load()} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                   : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </div>

      {/* What the desk did, and how it landed */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Kpi icon={Phone} label="Conversations" value={String(d.attempts)}
             sub={`${d.customers} customers reached out to`} />
        <Kpi icon={MessageCircle} label="Connected" value={pct(d.reachRate)}
             sub={`${d.reached} of ${d.answerable} that could answer`}
             tone={(d.reachRate ?? 100) < 60 ? "text-warning" : "text-success"} />
        <Kpi icon={PhoneOff} label="No answer" value={String(d.noAnswer)}
             sub={d.delivered > 0 ? `${d.delivered} delivered, unanswered` : "nothing undelivered"}
             tone={d.noAnswer > 0 ? "text-destructive" : ""} />
        <Kpi icon={Bot} label="Handled by bots" value={pct(d.automatedShare)}
             sub={`${d.automated} automated of ${d.attempts}`} />
        <Kpi icon={ArrowDownLeft} label="Customer got in touch" value={String(d.inbound)}
             sub="inbound, the rest were outbound" />
        <Kpi icon={Users} label="Led to a promise" value={String(d.ledToPromise)}
             sub={`${pct(d.promiseRate)} of connected conversations`} tone="text-success" />
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Volume over time */}
        <div className="lg:col-span-2">
          <Panel title="Conversations over time"
                 hint="Attempted against connected, day by day">
            <div className="p-3 h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={dayChart} margin={{ top: 6, right: 8, left: -22, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }}
                         stroke="hsl(var(--muted-foreground))" interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="attempts" fill="hsl(var(--muted-foreground))"
                       radius={[3, 3, 0, 0]} opacity={0.35} />
                  <Line type="monotone" dataKey="reached" stroke="hsl(var(--success))"
                        strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>

        {/* When people actually pick up */}
        <Panel
          title="When customers answer"
          hint="Reach rate by hour of day"
          right={bestHour ? (
            <Pill tone="bg-success/10 text-success border-success/25">
              best {String(bestHour.hour).padStart(2, "0")}:00
            </Pill>
          ) : undefined}
        >
          <div className="p-3 h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourChart} margin={{ top: 6, right: 8, left: -26, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 9 }}
                       stroke="hsl(var(--muted-foreground))" interval={1} />
                <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))"
                       tickFormatter={(v) => `${v}%`} />
                <Tooltip {...tooltipStyle}
                  formatter={(v: number, _n, item) =>
                    [`${v}% of ${item?.payload?.attempts ?? 0} attempts`, "Connected"]} />
                <Bar dataKey="reachRate" radius={[3, 3, 0, 0]}>
                  {hourChart.map((h) => (
                    <Cell key={h.hour}
                          fill={(h.reachRate ?? 0) >= 75 ? "hsl(var(--success))"
                              : (h.reachRate ?? 0) >= 50 ? "hsl(var(--primary))"
                              : "hsl(var(--muted-foreground))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        {/* Which channel is worth using */}
        <Panel title="By channel" hint="Where the conversations happen, and which connect">
          <div className="divide-y divide-border">
            {d.channels.map((c) => {
              const Icon = CHANNEL_ICON[c.channel] ?? MessageSquare;
              return (
                <button
                  key={c.channel}
                  onClick={() => setChannel(channel === c.channel ? "all" : c.channel)}
                  className={`w-full px-4 py-2.5 text-left transition hover:bg-muted/40 ${
                    channel === c.channel ? "bg-primary/5" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-3.5 w-3.5 shrink-0"
                          style={{ color: CHANNEL_FILL[c.channel] ?? "hsl(var(--primary))" }} />
                    <span className="text-xs font-medium text-foreground">{c.channel}</span>
                    <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                      {c.attempts}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full"
                         style={{
                           width: `${c.reachRate ?? 0}%`,
                           background: CHANNEL_FILL[c.channel] ?? "hsl(var(--primary))",
                         }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {pct(c.reachRate)} connected
                    {c.automated > 0 && ` · ${c.automated} automated`}
                  </div>
                </button>
              );
            })}
          </div>
        </Panel>

        {/* What came of them */}
        <Panel title="What came of them" hint="Outcomes recorded on connected conversations">
          <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
            {d.outcomes.length === 0 && (
              <p className="px-4 py-8 text-center text-xs text-muted-foreground">
                No outcomes recorded in this period.
              </p>
            )}
            {d.outcomes.map((o) => (
              <div key={o.outcome} className="px-4 py-2.5 flex items-center gap-2">
                <Pill tone={outcomeTone(o.outcome)}>{o.outcome.replace(/_/g, " ").toLowerCase()}</Pill>
                <span className="ml-auto text-xs tabular-nums font-medium">{o.count}</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Who is having them */}
        <Panel title="Who is talking to customers"
               hint="Attempts and reach rate per agent">
          <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
            {d.agentBoard.map((a) => (
              <button
                key={a.agentName}
                onClick={() => a.agentId && setAgentId(
                  agentId === String(a.agentId) ? "all" : String(a.agentId))}
                disabled={!a.agentId}
                className={`w-full px-4 py-2.5 text-left transition hover:bg-muted/40 disabled:hover:bg-transparent ${
                  agentId === String(a.agentId) ? "bg-primary/5" : ""}`}
              >
                <div className="flex items-center gap-2">
                  {!a.agentId && <Bot className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-xs font-medium text-foreground truncate">
                    {a.agentName}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {a.attempts}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {pct(a.reachRate)} connected · {a.customers} customers
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      {/* The conversations themselves */}
      <Panel
        title="Contact history"
        hint="Every call, message and bot exchange, newest first"
        right={
          <div className="flex items-center gap-2">
            {filtered && (
              <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
                Clear filters
              </Button>
            )}
            <div className="relative w-52">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                     placeholder="Customer, subject or outcome"
                     className="h-8 pl-7 text-xs" />
            </div>
            <Select value={channel} onValueChange={setChannel}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All channels</SelectItem>
                {options?.channels.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="Direction" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Both ways</SelectItem>
                {options?.directions.map((c) => (
                  <SelectItem key={c} value={c}>{c.toLowerCase()}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={reached} onValueChange={setReached}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Result" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any result</SelectItem>
                <SelectItem value="yes">Connected</SelectItem>
                <SelectItem value="no">Did not connect</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      >
        <div className="divide-y divide-border">
          {rows.length === 0 && (
            <p className="px-4 py-12 text-center text-xs text-muted-foreground">
              No conversations match these filters.
            </p>
          )}
          {rows.map((r) => {
            const Icon = CHANNEL_ICON[r.channel] ?? MessageSquare;
            return (
              <div key={r.id} className="px-4 py-3 hover:bg-muted/30 transition">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 h-7 w-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5"
                          style={{ color: CHANNEL_FILL[r.channel] ?? "hsl(var(--primary))" }} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">
                        {r.customerName}
                      </span>
                      {r.companyName && r.companyName !== r.customerName && (
                        <span className="text-[10px] text-muted-foreground truncate">
                          {r.companyName}
                        </span>
                      )}
                      {r.direction === "INBOUND"
                        ? <ArrowDownLeft className="h-3 w-3 text-info" />
                        : <ArrowUpRight className="h-3 w-3 text-muted-foreground" />}
                      {r.outcome && <Pill tone={outcomeTone(r.outcome)}>
                        {r.outcome.replace(/_/g, " ").toLowerCase()}
                      </Pill>}
                      {r.isAutomated && <Pill><Bot className="h-2.5 w-2.5 mr-0.5" /> bot</Pill>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{r.subject}</p>
                    {r.body && (
                      <p className="text-[11px] text-muted-foreground/80 mt-0.5 line-clamp-2">
                        {r.body}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                      <Clock className="h-3 w-3" /> {when(r.occurredAt)}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {r.agentName ?? "automated"}
                    </div>
                    {r.caseNumber && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {r.caseNumber}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {(page > 0 || rows.length === PAGE) && (
          <div className="flex items-center gap-2 px-4 py-2 border-t border-border">
            <span className="text-[11px] text-muted-foreground">
              {page * PAGE + 1}–{page * PAGE + rows.length}
            </span>
            <div className="ml-auto flex gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs"
                      disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Previous
              </Button>
              <Button variant="outline" size="sm" className="h-7 text-xs"
                      disabled={rows.length < PAGE} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
};

export default ContactHistory;
