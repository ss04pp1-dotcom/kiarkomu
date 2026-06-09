import React, { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_URL } from "@/lib/api-url";
import { useAuth } from "@/lib/auth";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, Legend,
  PieChart, Pie,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Eye, ShoppingCart, CreditCard, Package, ArrowRight,
  TrendingUp, Loader2, Globe, Megaphone, Radio, CalendarDays, X, Users,
  Smartphone, Monitor,
} from "lucide-react";

// ── Config ────────────────────────────────────────────────────────────────────
const FUNNEL_CONFIG = [
  { event: "view_content",      label: "View Product", icon: Eye,          color: "#6366f1", bg: "bg-indigo-50",  text: "text-indigo-600"  },
  { event: "add_to_cart",       label: "Add to Cart",  icon: ShoppingCart, color: "#f59e0b", bg: "bg-amber-50",   text: "text-amber-600"   },
  { event: "initiate_checkout", label: "Checkout",     icon: CreditCard,   color: "#10b981", bg: "bg-emerald-50", text: "text-emerald-600" },
  { event: "purchase",          label: "Purchase",     icon: Package,      color: "#ec4899", bg: "bg-pink-50",    text: "text-pink-600"    },
];

// Fallback config so unknown event keys never crash (Bug fix #4 / #9)
const FALLBACK_CFG = { event: "", label: "Unknown", icon: TrendingUp, color: "#9ca3af", bg: "bg-gray-50", text: "text-gray-500" };
function getFunnelCfg(event: string) {
  return FUNNEL_CONFIG.find(c => c.event === event) ?? FALLBACK_CFG;
}

const CHART_COLORS: Record<string, string> = {
  view_content:      "#6366f1",
  add_to_cart:       "#f59e0b",
  initiate_checkout: "#10b981",
  purchase:          "#ec4899",
};

const SOURCE_PALETTE = [
  "#6366f1","#f59e0b","#10b981","#ec4899","#3b82f6","#f97316","#14b8a6","#a855f7",
  "#64748b","#84cc16","#ef4444","#06b6d4",
];

const DAYS_OPTIONS = [
  { label: "Last 7 days",  value: "7"  },
  { label: "Last 14 days", value: "14" },
  { label: "Last 30 days", value: "30" },
  { label: "Last 60 days", value: "60" },
  { label: "Last 90 days", value: "90" },
];

// Bug fix #8: parse date-only strings with an explicit time component so they
// are treated as local midnight, not UTC midnight. "2026-01-15" parsed by
// new Date() is UTC 00:00 → displays as Jan 14 in UTC+6 browsers.
function parseLocalDate(d: string): Date {
  return new Date(d.length === 10 ? `${d}T00:00:00` : d);
}

// Bug fix #9: defined OUTSIDE component so the function reference is stable
// across renders. Recharts re-renders the whole chart when tickFormatter /
// labelFormatter references change, causing lag on every hover or state update.
function formatDate(d: string) {
  return parseLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

type Platform = "all" | "web" | "mobile";

// Appends &platform=web|mobile when a specific platform is selected.
function withPlatform(queryString: string, platform: Platform) {
  if (platform === "all") return queryString;
  return `${queryString}&platform=${platform}`;
}

// ── Hooks — accept a pre-built queryString like "days=30" or
//            "startDate=2026-01-01&endDate=2026-01-31" ─────────────────────────
function useFunnel(queryString: string, token: string) {
  return useQuery({
    queryKey: ["tracking-funnel", queryString],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/analytics/tracking-funnel?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTimeline(queryString: string, token: string) {
  return useQuery({
    queryKey: ["tracking-timeline", queryString],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/analytics/tracking-timeline?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTrafficSources(queryString: string, token: string) {
  return useQuery({
    queryKey: ["traffic-sources", queryString],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/analytics/traffic-sources?${queryString}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

type ActiveSessionsData = {
  activeSessions: number;
  totalEvents: number;
  windowMinutes: number;
  mobileSessions: number;
  webSessions: number;
};

// Polls every 30 s — shows unique session IDs active in the last 30 minutes.
function useActiveSessions(token: string) {
  return useQuery({
    queryKey: ["active-sessions"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/analytics/active-sessions?minutes=30`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<ActiveSessionsData>;
    },
    staleTime: 0,
    refetchInterval: 30_000,
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────
function FunnelStep({ step, isLast }: { step: any; isLast: boolean }) {
  // Bug fix #4: use getFunnelCfg() which falls back gracefully — eliminates the
  // non-null assertion crash when step.event is an unexpected/future key.
  const cfg = getFunnelCfg(step.event);
  const Icon = cfg.icon;
  // Bug fix #6: null-safe count — coerce to number before calling toLocaleString
  const count = Number(step.count ?? 0);
  const barWidth = Math.max(step.pct ?? 0, 3);

  return (
    <div className="flex items-center gap-4">
      <div className="w-44 shrink-0">
        <div className={`flex items-center gap-2 p-3 rounded-xl ${cfg.bg}`}>
          <Icon className={`w-4 h-4 ${cfg.text} shrink-0`} />
          <div className="min-w-0">
            <p className={`text-xs font-semibold ${cfg.text} truncate`}>{cfg.label}</p>
            <p className="text-lg font-bold text-gray-900">{count.toLocaleString()}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center gap-3">
        <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
          <div
            className="h-full rounded-full flex items-center justify-end pr-3 transition-all duration-700"
            style={{ width: `${barWidth}%`, backgroundColor: cfg.color }}
          >
            {barWidth > 12 && (
              <span className="text-white text-xs font-semibold">{step.pct}%</span>
            )}
          </div>
        </div>
        {barWidth <= 12 && (
          <span className="text-xs font-semibold text-gray-500 w-10 text-right">{step.pct}%</span>
        )}
        {!isLast && <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />}
      </div>
    </div>
  );
}

function SourceBadge({ label }: { label: string }) {
  const SOURCE_ICONS: Record<string, string> = {
    facebook: "🟦", fb: "🟦", instagram: "🟣", ig: "🟣",
    google: "🔴", email: "📧", sms: "💬", whatsapp: "💚",
    tiktok: "⬛", youtube: "🔴", twitter: "🔵", x: "⬛",
  };
  const icon = SOURCE_ICONS[label.toLowerCase()] ?? "🌐";
  return (
    <span className="font-medium text-gray-800 flex items-center gap-1">
      <span>{icon}</span> {label}
    </span>
  );
}

function TrafficTable({
  rows, cols,
}: {
  rows: any[];
  cols: Array<{ key: string; label: string; render?: (v: any, row: any) => React.ReactNode }>;
}) {
  if (!rows.length) {
    return <p className="text-sm text-gray-400 text-center py-6">No traffic data yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-xs text-gray-400 font-medium uppercase tracking-wide">
            {cols.map(c => (
              <th key={c.key} className="pb-2 text-left first:pl-0 pl-4 whitespace-nowrap">{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
              {cols.map(c => (
                <td key={c.key} className="py-2.5 first:pl-0 pl-4 whitespace-nowrap">
                  {c.render ? c.render(row[c.key], row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
const PLATFORM_OPTIONS: { value: Platform; label: string; icon: React.ElementType }[] = [
  { value: "all",    label: "All Traffic",    icon: Users      },
  { value: "web",    label: "Web Storefront", icon: Monitor    },
  { value: "mobile", label: "Mobile App",     icon: Smartphone },
];

export default function TrackingAnalytics() {
  const { token } = useAuth() as any;
  const authToken = token ?? localStorage.getItem("shohure_admin_token") ?? "";
  const [days, setDays] = useState("30");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [customApplied, setCustomApplied] = useState(false);
  const [sourceTab, setSourceTab] = useState<"source" | "medium" | "campaign">("source");
  const [platform, setPlatform] = useState<Platform>("all");

  const isCustomMode = days === "custom";
  const customValid = isCustomMode && !!customStart && !!customEnd && customStart <= customEnd;

  // Base date queryString — platform is appended separately per-hook
  const baseQueryString = (isCustomMode && customApplied && customValid)
    ? `startDate=${customStart}&endDate=${customEnd}`
    : `days=${isCustomMode ? "30" : days}`;

  // Platform-aware queryString passed to funnel, timeline, and traffic hooks
  const queryString = withPlatform(baseQueryString, platform);

  // Reset applied state when the user edits the dates
  useEffect(() => { setCustomApplied(false); }, [customStart, customEnd]);

  const { data: funnelData,        isLoading: funnelLoading   } = useFunnel(queryString, authToken);
  const { data: timelineData = [], isLoading: timelineLoading } = useTimeline(queryString, authToken);
  const { data: trafficData,       isLoading: trafficLoading  } = useTrafficSources(queryString, authToken);
  const { data: sessionData                                    } = useActiveSessions(authToken);

  const isLoading = funnelLoading || timelineLoading || trafficLoading;

  // Bug fix #9: formatDate is stable (module-level), but the Tooltip/XAxis
  // formatters are inline — wrap in useCallback so the chart DOM doesn't
  // re-mount on every hover/render cycle.
  const tooltipLabelFormatter = useCallback((d: string) => formatDate(d), []);
  const tooltipFormatter = useCallback(
    (value: number, name: string) => [value, getFunnelCfg(name).label],
    [],
  );
  const legendFormatter = useCallback((name: string) => getFunnelCfg(name).label, []);

  // Bug fix #10: for long time windows, computing an interval that results in
  // ~7 visible ticks avoids 90 overlapping labels on the x-axis.
  const xAxisInterval = Math.max(1, Math.ceil(timelineData.length / 7)) - 1;

  const sourceRows: any[]   = trafficData?.bySource   ?? [];
  const mediumRows: any[]   = trafficData?.byMedium   ?? [];
  const campaignRows: any[] = trafficData?.byCampaign ?? [];

  const hasAnyUTM = sourceRows.some((r: any) => r.source !== "(direct)");

  const activeRows =
    sourceTab === "source"   ? sourceRows :
    sourceTab === "medium"   ? mediumRows :
    campaignRows;

  // Bar chart data — top 8 sources by sessions, excluding direct traffic
  const barData = sourceRows
    .filter((r: any) => r.source !== "(direct)")
    .slice(0, 8);

  // Bug fix #5: separate the empty-state condition so it is ONLY shown when
  // there are genuinely no events. Previously the funnel rendered both the
  // step bars AND the empty-state message simultaneously when totalEvents=0
  // because the funnel array always has 4 items (all with count=0).
  const funnelSteps: any[] = funnelData?.funnel ?? [];
  const totalEvents: number = funnelData?.totalEvents ?? 0;
  const hasFunnelData = funnelSteps.length > 0 && totalEvents > 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-7 w-7 text-purple-500" />
            Tracking Analytics
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Events from your storefront — Views, Add to Cart, Checkout, Purchases &amp; Campaign attribution.
          </p>
        </div>
        {/* ── Date range + platform filters ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">

          {/* Platform toggle — All / Web / Mobile */}
          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
            {PLATFORM_OPTIONS.map(o => {
              const Icon = o.icon;
              return (
                <button
                  key={o.value}
                  onClick={() => setPlatform(o.value)}
                  className={`px-3 py-2 font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                    platform === o.value
                      ? "bg-indigo-600 text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                  title={o.label}
                >
                  <Icon className="w-3 h-3" />
                  <span className="hidden sm:inline">{o.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs bg-white">
            {DAYS_OPTIONS.map(o => (
              <button
                key={o.value}
                onClick={() => { setDays(o.value); setCustomApplied(false); }}
                className={`px-3 py-2 font-medium transition-colors whitespace-nowrap ${
                  days === o.value
                    ? "bg-purple-600 text-white"
                    : "text-gray-500 hover:bg-gray-50"
                }`}
              >
                {o.label.replace("Last ", "")}
              </button>
            ))}
            <button
              onClick={() => setDays("custom")}
              className={`px-3 py-2 font-medium transition-colors flex items-center gap-1 whitespace-nowrap ${
                isCustomMode
                  ? "bg-purple-600 text-white"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              <CalendarDays className="w-3 h-3" />
              Custom
            </button>
          </div>

          {/* Custom date inputs — visible only when Custom is selected */}
          {isCustomMode && (
            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={e => setCustomStart(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={e => setCustomEnd(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                disabled={!customValid}
                onClick={() => setCustomApplied(true)}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-purple-600 hover:bg-purple-700 text-white"
              >
                Apply
              </button>
              {customApplied && (
                <button
                  onClick={() => { setCustomStart(""); setCustomEnd(""); setCustomApplied(false); setDays("30"); }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Clear custom range"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Live Visitors banner — auto-refreshes every 30 s ── */}
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border border-gray-100 rounded-xl shadow-sm">
        {/* Pulse dot */}
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
        </span>

        {/* Total count */}
        <div className="flex items-baseline gap-1.5">
          <Users className="w-4 h-4 text-emerald-600" />
          <span className="text-xl font-bold text-gray-900">
            {sessionData
              ? (platform === "mobile"
                  ? (sessionData.mobileSessions ?? 0)
                  : platform === "web"
                    ? (sessionData.webSessions ?? 0)
                    : (sessionData.activeSessions ?? 0)
                ).toLocaleString()
              : "—"}
          </span>
          <span className="text-sm text-gray-500">
            live {platform === "mobile" ? "app" : platform === "web" ? "web" : ""} visitor{
              (platform === "mobile" ? (sessionData?.mobileSessions ?? 0) : platform === "web" ? (sessionData?.webSessions ?? 0) : (sessionData?.activeSessions ?? 0)) !== 1 ? "s" : ""
            } · last 30 min
          </span>
        </div>

        {/* Web / Mobile split — shown only in "All Traffic" view */}
        {platform === "all" && sessionData && (sessionData.webSessions > 0 || sessionData.mobileSessions > 0) && (
          <>
            <span className="w-px h-5 bg-gray-100 shrink-0" />
            <div className="flex items-center gap-2 text-xs">
              <Monitor className="w-3.5 h-3.5 text-indigo-400" />
              <span className="font-semibold text-gray-700">{sessionData.webSessions.toLocaleString()}</span>
              <span className="text-gray-400">web</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Smartphone className="w-3.5 h-3.5 text-purple-400" />
              <span className="font-semibold text-gray-700">{sessionData.mobileSessions.toLocaleString()}</span>
              <span className="text-gray-400">app</span>
            </div>

            {/* Mini pie — web vs mobile proportion */}
            {(sessionData.webSessions + sessionData.mobileSessions) > 0 && (
              <div title={`Web ${sessionData.webSessions} · App ${sessionData.mobileSessions}`}>
                <PieChart width={32} height={32}>
                  <Pie
                    data={[
                      { name: "web",    value: sessionData.webSessions    },
                      { name: "mobile", value: sessionData.mobileSessions },
                    ]}
                    cx={14} cy={14} innerRadius={8} outerRadius={14}
                    dataKey="value" strokeWidth={0}
                  >
                    <Cell fill="#6366f1" />
                    <Cell fill="#a855f7" />
                  </Pie>
                </PieChart>
              </div>
            )}
          </>
        )}

        {/* Total events */}
        {sessionData && sessionData.totalEvents > 0 && (
          <span className="text-xs text-gray-400 border-l border-gray-100 pl-3 ml-auto">
            {sessionData.totalEvents.toLocaleString()} event{sessionData.totalEvents !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
        </div>
      ) : (
        <>
          {/* ── KPI Strip ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {funnelSteps.map((step: any) => {
              // Bug fix #4/#9: safe cfg lookup, never crashes on unknown events
              const cfg = getFunnelCfg(step.event);
              const Icon = cfg.icon;
              // Bug fix #6: null-safe count coercion
              const count = Number(step.count ?? 0);
              return (
                <Card key={step.event}>
                  <CardContent className="p-5 flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${cfg.bg} shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.text}`} />
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500">{cfg.label}</p>
                      <p className="text-2xl font-bold text-gray-900">{count.toLocaleString()}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* ── Conversion Funnel ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conversion Funnel</CardTitle>
              <p className="text-xs text-gray-500 -mt-1">Percentage relative to total product views</p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Bug fix #5: only render steps when there is actual data;
                  only render the empty state when there is none. Never both. */}
              {hasFunnelData ? (
                funnelSteps.map((step: any, i: number) => (
                  <FunnelStep key={step.event} step={step} isLast={i === funnelSteps.length - 1} />
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                  <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">No events recorded yet.</p>
                  <p className="text-xs mt-1">Add your Pixel / Tag ID in Settings → Tracking to start collecting data.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Events Timeline ── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Events Over Time</CardTitle>
            </CardHeader>
            <CardContent>
              {timelineData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No timeline data yet.</div>
              ) : (
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        {Object.entries(CHART_COLORS).map(([key, color]) => (
                          <linearGradient key={key} id={`grad-${key}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%"  stopColor={color} stopOpacity={0.25} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      {/* Bug fix #10: interval limits visible ticks to ~7 so 90-day
                          view doesn't render 90 overlapping date labels */}
                      <XAxis
                        dataKey="date"
                        tickFormatter={formatDate}
                        interval={xAxisInterval}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                        dy={8}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      {/* Bug fix #9: stable useCallback refs prevent chart re-mount on hover */}
                      <Tooltip
                        formatter={tooltipFormatter}
                        labelFormatter={tooltipLabelFormatter}
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                      />
                      <Legend formatter={legendFormatter} />
                      {Object.entries(CHART_COLORS).map(([key, color]) => (
                        <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#grad-${key})`} dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Traffic Sources ─────────────────────────────────────────── */}
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-500" /> Traffic Sources
            </h3>
            <p className="text-sm text-gray-500">
              Which campaigns are bringing visitors — and which ones convert to purchases.
              {!hasAnyUTM && (
                <span className="ml-1 font-medium text-amber-600">
                  Add <code className="bg-amber-50 px-1 rounded text-xs">?utm_source=facebook&amp;utm_medium=cpc&amp;utm_campaign=summer-sale</code> to your ad links to start seeing data here.
                </span>
              )}
            </p>
          </div>

          {/* Source bar chart */}
          {barData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" /> Sessions by Source
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                      <XAxis dataKey="source" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#6b7280" }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#9ca3af" }} />
                      <Tooltip
                        contentStyle={{ borderRadius: "8px", border: "1px solid #e5e7eb", fontSize: "12px" }}
                        formatter={(v: number, name: string) => [v, name === "sessions" ? "Sessions" : "Purchases"]}
                      />
                      <Bar dataKey="sessions" name="sessions" radius={[4, 4, 0, 0]}>
                        {barData.map((_: any, idx: number) => (
                          <Cell key={idx} fill={SOURCE_PALETTE[idx % SOURCE_PALETTE.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tab table */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Campaign Attribution</CardTitle>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
                  {(["source", "medium", "campaign"] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setSourceTab(tab)}
                      className={`px-3 py-1.5 capitalize transition-colors ${
                        sourceTab === tab
                          ? "bg-purple-600 text-white font-medium"
                          : "text-gray-500 hover:bg-gray-50"
                      }`}
                    >
                      {tab === "source" ? <Globe className="inline w-3 h-3 mr-1" /> :
                       tab === "medium" ? <Radio className="inline w-3 h-3 mr-1" /> :
                       <Megaphone className="inline w-3 h-3 mr-1" />}
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {sourceTab === "source" && (
                <TrafficTable
                  rows={sourceRows}
                  cols={[
                    { key: "source", label: "Source", render: (v: string) => <SourceBadge label={v} /> },
                    { key: "sessions",       label: "Sessions",    render: (v: number) => <span className="font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "purchases",      label: "Purchases",   render: (v: number) => <span className="text-pink-600 font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "revenue",        label: "Revenue",     render: (v: number) => <span className="font-medium">৳{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "conversionRate", label: "Conv. Rate",  render: (v: number) => (
                      <span className={`font-semibold ${v >= 5 ? "text-emerald-600" : v >= 1 ? "text-amber-600" : "text-gray-400"}`}>
                        {v ?? 0}%
                      </span>
                    )},
                  ]}
                />
              )}
              {sourceTab === "medium" && (
                <TrafficTable
                  rows={mediumRows}
                  cols={[
                    { key: "medium",         label: "Medium",      render: (v: string) => <span className="font-medium text-gray-800">{v}</span> },
                    { key: "sessions",       label: "Sessions",    render: (v: number) => <span className="font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "purchases",      label: "Purchases",   render: (v: number) => <span className="text-pink-600 font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "revenue",        label: "Revenue",     render: (v: number) => <span className="font-medium">৳{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "conversionRate", label: "Conv. Rate",  render: (v: number) => (
                      <span className={`font-semibold ${v >= 5 ? "text-emerald-600" : v >= 1 ? "text-amber-600" : "text-gray-400"}`}>
                        {v ?? 0}%
                      </span>
                    )},
                  ]}
                />
              )}
              {sourceTab === "campaign" && (
                <TrafficTable
                  rows={campaignRows}
                  cols={[
                    { key: "campaign",       label: "Campaign",    render: (v: string, row: any) => (
                      <div>
                        <p className="font-medium text-gray-800">{v}</p>
                        <p className="text-xs text-gray-400">{row.source} / {row.medium}</p>
                      </div>
                    )},
                    { key: "sessions",       label: "Sessions",    render: (v: number) => <span className="font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "purchases",      label: "Purchases",   render: (v: number) => <span className="text-pink-600 font-medium">{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "revenue",        label: "Revenue",     render: (v: number) => <span className="font-medium">৳{Number(v ?? 0).toLocaleString()}</span> },
                    { key: "conversionRate", label: "Conv. Rate",  render: (v: number) => (
                      <span className={`font-semibold ${v >= 5 ? "text-emerald-600" : v >= 1 ? "text-amber-600" : "text-gray-400"}`}>
                        {v ?? 0}%
                      </span>
                    )},
                  ]}
                />
              )}
            </CardContent>
          </Card>

          {/* ── Top Products ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="w-4 h-4 text-indigo-500" /> Top Viewed Products
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(funnelData?.topViewed ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No view events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(funnelData?.topViewed ?? []).map((p: any, i: number) => (
                      <div key={p.productId ?? i} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                          <p className="text-sm text-gray-700 truncate">{p.productName ?? `Product #${p.productId}`}</p>
                        </div>
                        <span className="text-sm font-semibold text-indigo-600 shrink-0">{Number(p.count ?? 0).toLocaleString()} views</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-amber-500" /> Top Added to Cart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(funnelData?.topAdded ?? []).length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-4">No add-to-cart events yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(funnelData?.topAdded ?? []).map((p: any, i: number) => (
                      <div key={p.productId ?? i} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{i + 1}</span>
                          <p className="text-sm text-gray-700 truncate">{p.productName ?? `Product #${p.productId}`}</p>
                        </div>
                        <span className="text-sm font-semibold text-amber-600 shrink-0">{Number(p.count ?? 0).toLocaleString()} adds</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
