'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import {
  getForexAdminCommandAttention,
  getForexAdminConfig,
  getForexAdminCrmRecentActivities,
  getForexAdminExecution,
  getForexAdminJournal,
  getForexAdminMarketDataQuotes,
  getForexAdminOverview,
  getForexAdminSearch,
  type ForexAdminExecutionSnapshot,
  type ForexCommandAttentionItem,
} from '@/lib/admin/forex-api';
import { FOREX_NAV_GROUPS, forexRoutesInGroup, type ForexNavGroupId } from '@/lib/admin/forex-nav-groups';
import { deriveForexVenueMode } from '@/lib/admin/forex-posture';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import {
  ForexExposureBar,
  ForexSectionLabel,
  ForexSpreadBar,
  ForexWorkspaceSurface,
} from '@/components/forex/primitives/forex-visual-kit';
import {
  Activity,
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  ChevronRight,
  Gauge,
  Hand,
  Layers,
  LineChart,
  Radio,
  Search,
  Server,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';

const SESSION_DEFS = [
  { name: 'Sydney', timezone: 'Australia/Sydney', openHour: 7, closeHour: 16 },
  { name: 'Tokyo', timezone: 'Asia/Tokyo', openHour: 9, closeHour: 18 },
  { name: 'London', timezone: 'Europe/London', openHour: 8, closeHour: 17 },
  { name: 'New York', timezone: 'America/New_York', openHour: 8, closeHour: 17 },
] as const;

function sessionOpen(def: (typeof SESSION_DEFS)[number], now: Date) {
  const fmt = new Intl.DateTimeFormat('en-US', { timeZone: def.timezone, weekday: 'short', hour: 'numeric', hour12: false });
  const parts = fmt.formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  if (weekday === 'Sat' || weekday === 'Sun') return false;
  return hour >= def.openHour && hour < def.closeHour;
}

function severityStripe(sev: ForexCommandAttentionItem['severity']) {
  if (sev === 'critical') return 'border-l-red-500';
  if (sev === 'high') return 'border-l-amber-500';
  if (sev === 'medium') return 'border-l-violet-500';
  return 'border-l-admin-border';
}

const ATTENTION_FILTERS = ['all', 'dealing', 'risk', 'finance', 'compliance', 'crm', 'system'] as const;

type RiskHub = {
  exposure_summary?: { gross_volume_lots?: string; net_volume_lots?: string };
  symbol_exposure?: Array<{ symbol: string; long_vol: string; short_vol: string }>;
};

function groupIcon(id: ForexNavGroupId) {
  const map: Record<ForexNavGroupId, typeof Radio> = {
    command: Activity,
    trading: ShoppingCart,
    risk: Shield,
    crm: Users,
    accounts: BookOpen,
    markets: Radio,
    liquidity: Zap,
    finance: Layers,
    partners: Building2,
    compliance: Shield,
    automation: SlidersHorizontal,
    reporting: LineChart,
    system: Server,
  };
  return map[id] ?? SlidersHorizontal;
}

function domainMetric(id: ForexNavGroupId, ctx: {
  openOrders: number;
  openPositions: number;
  ledgerAccounts: number;
  mdRunning: boolean;
  killSwitch: boolean;
  attentionHigh: number;
}) {
  switch (id) {
    case 'trading':
      return `${ctx.openOrders} open orders`;
    case 'risk':
      return ctx.killSwitch ? 'Kill switch ON' : 'Risk monitoring';
    case 'accounts':
      return `${ctx.ledgerAccounts} ledger accounts`;
    case 'markets':
      return ctx.mdRunning ? 'Quotes active' : 'Worker stopped';
    case 'command':
      return ctx.attentionHigh > 0 ? `${ctx.attentionHigh} high priority` : 'All clear';
    default:
      return 'Open workspace';
  }
}

export function ForexCommandCenterView() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const admin = useAdminAuthStore((s) => s.admin);
  const [searchQ, setSearchQ] = useState('');
  const [attentionFilter, setAttentionFilter] = useState<(typeof ATTENTION_FILTERS)[number]>('all');
  const now = useMemo(() => new Date(), []);

  const overviewQ = useQuery({
    queryKey: ['admin', 'forex', 'overview', 'command-center', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', 'command-center', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 30_000,
  });

  const execQ = useQuery({
    queryKey: ['admin', 'forex', 'execution', 'command-center', token],
    queryFn: async () => {
      const res = await getForexAdminExecution(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const attentionQ = useQuery({
    queryKey: ['admin', 'forex', 'command', 'attention', 'cc', token],
    queryFn: async () => {
      const res = await getForexAdminCommandAttention(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const quotesQ = useQuery({
    queryKey: ['admin', 'forex', 'market-data', 'quotes', 'pulse', token],
    queryFn: async () => {
      const res = await getForexAdminMarketDataQuotes(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    refetchInterval: 20_000,
  });

  const riskQ = useQuery({
    queryKey: ['admin', 'forex', 'risk-hub', 'cc', token],
    queryFn: async () => {
      const res = await adminFetch<RiskHub>('/forex/risk/hub', { token });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 20_000,
  });

  const journalQ = useQuery({
    queryKey: ['admin', 'forex', 'journal', 'cc', token],
    queryFn: async () => {
      const res = await getForexAdminJournal(token, { page: 1, limit: 12 });
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 25_000,
  });

  const crmActQ = useQuery({
    queryKey: ['admin', 'forex', 'crm', 'activities', 'cc', token],
    queryFn: async () => {
      const res = await getForexAdminCrmRecentActivities(token, 12);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 25_000,
  });

  const searchQuery = useQuery({
    queryKey: ['admin', 'forex', 'search', 'cc', token, searchQ],
    queryFn: async () => {
      const res = await getForexAdminSearch(token, searchQ.trim());
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && searchQ.trim().length >= 2,
  });

  const overview = overviewQ.data;
  const posture = overview?.posture;
  const venue = deriveForexVenueMode(posture);
  const counts = overview?.counts;
  const md = configQ.data?.runtime.marketData ?? execQ.data?.marketData;
  const exec: ForexAdminExecutionSnapshot | undefined = execQ.data;

  const filteredAttention = useMemo(() => {
    const items = attentionQ.data?.items ?? [];
    if (attentionFilter === 'all') return items;
    return items.filter((i) => i.category.toLowerCase().includes(attentionFilter));
  }, [attentionQ.data?.items, attentionFilter]);

  const liveFeed = useMemo(() => {
    const rows: Array<{ id: string; kind: string; summary: string; at: string; icon: typeof Activity }> = [];
    for (const j of journalQ.data?.rows ?? []) {
      rows.push({
        id: `j-${j.id}`,
        kind: j.event_type,
        summary: j.message,
        at: j.created_at,
        icon: Activity,
      });
    }
    for (const a of crmActQ.data?.rows ?? []) {
      rows.push({
        id: `c-${a.activity_id}`,
        kind: a.kind,
        summary: a.summary,
        at: a.created_at,
        icon: Users,
      });
    }
    return rows.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 14);
  }, [journalQ.data?.rows, crmActQ.data?.rows]);

  const fillTotals = exec?.fillRecon?.totals;
  const fillRate =
    fillTotals && fillTotals.executions > 0
      ? `${((fillTotals.filled / fillTotals.executions) * 100).toFixed(1)}%`
      : null;
  const primaryProvider = exec?.providers?.[0];
  const rejectRate = primaryProvider?.health?.rejectRate;
  const rejectDisplay = rejectRate != null && Number.isFinite(rejectRate) ? String(rejectRate) : null;

  const exposureRows = riskQ.data?.symbol_exposure ?? [];
  let longSum = 0;
  let shortSum = 0;
  for (const r of exposureRows) {
    longSum += Number.parseFloat(r.long_vol) || 0;
    shortSum += Number.parseFloat(r.short_vol) || 0;
  }

  if (overviewQ.isLoading && !overview) {
    return <KpiSkeleton count={6} />;
  }

  const ctx = {
    openOrders: counts?.openOrders ?? 0,
    openPositions: counts?.openPositions ?? 0,
    ledgerAccounts: counts?.ledgerAccounts ?? 0,
    mdRunning: !!md?.running,
    killSwitch: !!posture?.killSwitch,
    attentionHigh: (attentionQ.data?.totals.high ?? 0) + (attentionQ.data?.totals.critical ?? 0),
  };

  return (
    <div className="space-y-4 pb-8">
      {/* TOP COMMAND BAR */}
      <ForexWorkspaceSurface className="!p-0 overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-admin-border/80 bg-gradient-to-r from-violet-500/[0.06] to-transparent px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-300/90">Forex Command Center</p>
            <p className="text-xs text-admin-muted">
              {venue.mode} · {posture?.executionMode ?? 'MOCK'} execution · {friendlyQuoteSource(posture?.source)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {SESSION_DEFS.map((s) => {
              const open = sessionOpen(s, now);
              return (
                <div
                  key={s.name}
                  className={cn(
                    'rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                    open
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
                      : 'border-admin-border/60 bg-admin-bg/40 text-admin-muted',
                  )}
                >
                  {s.name}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2 xl:min-w-[28rem] xl:justify-end">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-admin-muted" />
              <Input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search clients, accounts, orders, symbols…"
                className="h-9 border-violet-500/20 bg-admin-bg/60 pl-8 text-xs focus:border-violet-500/40"
              />
              {searchQ.trim().length >= 2 && searchQuery.data?.hits.length ? (
                <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-admin-border bg-admin-bg shadow-lg text-xs">
                  {searchQuery.data.hits.slice(0, 8).map((h) => (
                    <li key={`${h.domain}-${h.id}`} className="border-b border-admin-border/40 px-2 py-1.5 last:border-0">
                      <Link href={h.href_hint} className="text-violet-200 hover:underline">
                        {h.label}
                      </Link>
                      <span className="ml-2 text-admin-muted">{h.domain}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Link href="/forex/notifications">
              <Button type="button" variant="ghost" size="sm" className="h-9 gap-1">
                <Bell className="h-3.5 w-3.5" />
                Alerts
              </Button>
            </Link>
            <Badge variant={venue.mode === 'LIVE' ? 'danger' : 'warning'} className="font-normal">
              {venue.mode}
            </Badge>
            <span className="hidden text-[10px] text-admin-muted sm:inline">{admin?.name ?? admin?.email ?? 'Operator'}</span>
            <Link href="/forex/controls">
              <Button type="button" size="sm" className="h-9 border-red-500/40 bg-red-500/10 text-red-200 hover:bg-red-500/20">
                Emergency
              </Button>
            </Link>
          </div>
        </div>
      </ForexWorkspaceSurface>

      {/* OPERATING STATE */}
      <div className="grid gap-3 lg:grid-cols-12">
        <ForexWorkspaceSurface className="lg:col-span-5">
          <ForexSectionLabel>Forex operating environment</ForexSectionLabel>
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-lg font-semibold text-foreground">{venue.mode}</p>
              <p className="text-[11px] text-admin-muted">{posture?.executionMode ?? '—'} · No real LP · Crypto wallets excluded</p>
            </div>
            <Badge variant="info" className="font-normal">
              Simulated quotes
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SystemDot label="Market data" ok={!!md?.running && !!md?.enabled} detail={md?.running ? 'Running' : 'Stopped'} />
            <SystemDot label="Execution" ok={!posture?.killSwitch} detail={posture?.executionMode ?? '—'} warn={!!posture?.killSwitch} />
            <SystemDot label="Risk" ok={!posture?.killSwitch} detail={posture?.killSwitch ? 'Halt' : 'Nominal'} warn={!!posture?.killSwitch} />
            <SystemDot
              label="Ledger"
              ok={!!overview?.readiness.economicReady}
              detail={overview?.readiness.economicReady ? 'Ready' : 'Not ready'}
              warn={!overview?.readiness.economicReady}
            />
          </div>
        </ForexWorkspaceSurface>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:col-span-7 lg:grid-cols-5">
          <MetricCompact label="Open orders" value={String(counts?.openOrders ?? '—')} href="/forex/orders" sub="Working & pending" />
          <MetricCompact label="Open positions" value={String(counts?.openPositions ?? '—')} href="/forex/positions" sub="Live exposure" />
          <MetricCompact label="Ledger accounts" value={String(counts?.ledgerAccounts ?? '—')} href="/forex/accounts" sub="Trading accounts" />
          <MetricCompact
            label="Quote worker"
            value={md?.running ? 'Running' : 'Stopped'}
            href="/forex/market-data"
            sub={md?.source ?? '—'}
            tone={md?.running ? 'ok' : 'warn'}
          />
          <MetricCompact
            label="24h fills"
            value={fillTotals ? String(fillTotals.filled) : '—'}
            href="/forex/executions"
            sub={fillTotals ? `${fillTotals.failed} failed` : 'No recon window'}
          />
        </div>
      </div>

      {/* MARKET + RISK + EXECUTION */}
      <div className="grid gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-7" noPadding>
          <div className="border-b border-admin-border px-4 py-2.5">
            <ForexSectionLabel icon={Radio}>Market pulse</ForexSectionLabel>
          </div>
          {quotesQ.isError ? (
            <p className="p-4 text-xs text-red-400">{quotesQ.error instanceof Error ? quotesQ.error.message : 'Quotes unavailable'}</p>
          ) : quotesQ.isLoading ? (
            <p className="p-4 text-xs text-admin-muted">Loading quotes…</p>
          ) : !quotesQ.data?.rows.length ? (
            <p className="p-4 text-xs text-admin-muted">No quote rows — worker may be stopped.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-xs">
                <thead>
                  <tr className="border-b border-admin-border/80 text-[10px] uppercase tracking-wide text-admin-muted">
                    <th className="px-4 py-2 font-medium">Symbol</th>
                    <th className="px-2 py-2 font-medium">Bid</th>
                    <th className="px-2 py-2 font-medium">Ask</th>
                    <th className="px-2 py-2 font-medium">Spread</th>
                    <th className="px-2 py-2 font-medium">Age</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {quotesQ.data.rows.slice(0, 8).map((row) => (
                    <tr key={row.symbol} className="border-b border-admin-border/40 hover:bg-white/[0.02]">
                      <td className="px-4 py-2 font-medium">{row.symbol}</td>
                      <td className="px-2 py-2 font-mono tabular-nums">{row.bid}</td>
                      <td className="px-2 py-2 font-mono tabular-nums">{row.ask}</td>
                      <td className="px-2 py-2">
                        <ForexSpreadBar spreadPips={String(row.spread_pips)} stale={row.stale} />
                      </td>
                      <td className="px-2 py-2 tabular-nums text-admin-muted">{row.age_sec}s</td>
                      <td className="px-4 py-2">
                        <Badge variant={row.stale ? 'warning' : row.status === 'TRADEABLE' ? 'success' : 'default'} className="text-[9px] font-normal">
                          {row.stale ? 'Stale' : row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ForexWorkspaceSurface>

        <div className="flex flex-col gap-3 xl:col-span-5">
          <ForexWorkspaceSurface>
            <ForexSectionLabel icon={Gauge}>Risk & exposure</ForexSectionLabel>
            {riskQ.isError ? (
              <p className="text-xs text-admin-muted">Exposure unavailable</p>
            ) : exposureRows.length === 0 ? (
              <p className="text-xs text-admin-muted">No open symbol exposure.</p>
            ) : (
              <>
                <ForexExposureBar long={longSum} short={shortSum} symbol="Net book" />
                <div className="mt-2 space-y-2">
                  {exposureRows.slice(0, 4).map((r) => (
                    <ForexExposureBar
                      key={r.symbol}
                      symbol={r.symbol}
                      long={Number.parseFloat(r.long_vol) || 0}
                      short={Number.parseFloat(r.short_vol) || 0}
                    />
                  ))}
                </div>
                <Link href="/forex/risk-control" className="mt-2 inline-block text-[10px] text-violet-400 hover:text-violet-300">
                  Open risk cockpit →
                </Link>
              </>
            )}
          </ForexWorkspaceSurface>

          <ForexWorkspaceSurface>
            <ForexSectionLabel icon={Zap}>Execution health</ForexSectionLabel>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <StatLine label="Fill rate (24h window)" value={fillRate ?? 'Unavailable'} mono={!!fillRate} />
              <StatLine label="Latency" value="Unavailable" hint="Not reported by MOCK venue" />
              <StatLine label="Quote source" value={posture?.source ?? '—'} mono />
              <StatLine label="Rejects (provider)" value={rejectDisplay ?? '—'} mono={!!rejectDisplay} />
              <StatLine label="Mode" value={posture?.executionMode ?? '—'} />
              <StatLine
                label="Provider health"
                value={primaryProvider?.health?.status ?? 'NOT_CONFIGURED'}
              />
            </div>
            <Link href="/forex/lp-execution" className="mt-2 inline-block text-[10px] text-violet-400 hover:text-violet-300">
              LP & execution →
            </Link>
          </ForexWorkspaceSurface>
        </div>
      </div>

      {/* ATTENTION */}
      <ForexWorkspaceSurface noPadding>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-admin-border px-4 py-3">
          <ForexSectionLabel icon={AlertTriangle}>What needs attention now</ForexSectionLabel>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => void attentionQ.refetch()}>
            Refresh
          </Button>
        </div>
        <div className="flex flex-wrap gap-1 border-b border-admin-border/60 px-4 py-2">
          {ATTENTION_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setAttentionFilter(f)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide transition-colors',
                attentionFilter === f ? 'bg-violet-500/20 text-violet-200' : 'text-admin-muted hover:bg-white/5',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="p-3">
          {attentionQ.isError ? (
            <p className="text-xs text-red-400">Attention queue unavailable</p>
          ) : filteredAttention.length === 0 ? (
            <p className="text-xs text-admin-muted">No items in this filter — monitor posture and market pulse above.</p>
          ) : (
            <div className="space-y-1.5">
              {filteredAttention.map((item) => (
                <Link
                  key={`${item.category}-${item.title}-${item.href}`}
                  href={item.href}
                  className={cn(
                    'flex flex-wrap items-center gap-2 rounded-lg border border-admin-border/60 border-l-4 bg-admin-bg/30 px-3 py-2 text-xs transition hover:border-violet-500/30 hover:bg-violet-500/5',
                    severityStripe(item.severity),
                  )}
                >
                  <Badge variant={item.severity === 'critical' ? 'danger' : item.severity === 'high' ? 'warning' : 'info'} className="text-[9px] font-normal capitalize">
                    {item.severity}
                  </Badge>
                  <span className="font-medium uppercase text-admin-muted">{item.category.replace(/_/g, ' ')}</span>
                  <span className="min-w-0 flex-1 font-medium text-foreground">{item.title}</span>
                  {item.detail ? <span className="hidden text-admin-muted md:inline">{item.detail}</span> : null}
                  {item.count != null ? <span className="tabular-nums text-admin-muted">{item.count} open</span> : null}
                  <span className="text-violet-400">Review →</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </ForexWorkspaceSurface>

      {/* LIVE OPS + QUICK ACTIONS */}
      <div className="grid gap-3 xl:grid-cols-12">
        <ForexWorkspaceSurface className="xl:col-span-8">
          <ForexSectionLabel icon={Activity}>Live operations</ForexSectionLabel>
          {journalQ.isLoading && crmActQ.isLoading ? (
            <p className="text-xs text-admin-muted">Loading activity…</p>
          ) : liveFeed.length === 0 ? (
            <p className="text-xs text-admin-muted">No recent journal or CRM activity in scope.</p>
          ) : (
            <ul className="max-h-[280px] space-y-0 overflow-y-auto">
              {liveFeed.map((ev) => (
                <li key={ev.id} className="flex gap-3 border-b border-admin-border/40 py-2 last:border-0">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                    <ev.icon className="h-3.5 w-3.5 text-violet-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{ev.summary}</p>
                    <p className="text-[10px] text-admin-muted">
                      {ev.kind} · {new Date(ev.at).toLocaleString()}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link href="/forex/journal-audit" className="mt-2 inline-block text-[10px] text-violet-400 hover:text-violet-300">
            Full journal & audit →
          </Link>
        </ForexWorkspaceSurface>

        <ForexWorkspaceSurface className="xl:col-span-4">
          <ForexSectionLabel>Operator actions</ForexSectionLabel>
          <div className="grid gap-1.5">
            <ActionLink href="/forex/controls" label="Global controls" icon={SlidersHorizontal} impact />
            <ActionLink href="/forex/dealing" label="Open dealing desk" icon={Hand} />
            <ActionLink href="/forex/lp-execution" label="LP & execution" icon={Zap} />
            <ActionLink href="/forex/market-data" label="Market data center" icon={Radio} />
            <ActionLink href="/forex/system" label="System health" icon={Server} />
            <ActionLink href="/forex/command" label="Command desk detail" icon={Activity} />
          </div>
        </ForexWorkspaceSurface>
      </div>

      {/* OPERATIONS MAP */}
      <ForexWorkspaceSurface>
        <ForexSectionLabel>Operations map</ForexSectionLabel>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {FOREX_NAV_GROUPS.filter((g) => g.id !== 'command').map((group) => {
            const routes = forexRoutesInGroup(group.id);
            const primary = routes[0];
            const Icon = groupIcon(group.id);
            if (!primary) return null;
            return (
              <Link
                key={group.id}
                href={primary.href}
                className="group flex flex-col rounded-lg border border-admin-border/70 bg-admin-bg/25 p-3 transition hover:border-violet-500/35 hover:bg-violet-500/5"
              >
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                    <Icon className="h-4 w-4 text-violet-400" />
                  </div>
                  <ChevronRight className="h-4 w-4 text-admin-muted opacity-0 transition group-hover:opacity-100" />
                </div>
                <p className="text-sm font-semibold text-foreground">{group.label}</p>
                <p className="mt-0.5 text-[10px] font-medium text-violet-300/90">{domainMetric(group.id, ctx)}</p>
                <p className="mt-1 line-clamp-2 text-[10px] text-admin-muted">{group.description}</p>
                <span className="mt-2 text-[10px] font-medium text-violet-400">Open workspace →</span>
              </Link>
            );
          })}
        </div>
      </ForexWorkspaceSurface>
    </div>
  );
}

function friendlyQuoteSource(source: string | undefined) {
  const s = (source ?? 'SIMULATED').toUpperCase();
  if (s.includes('SIM')) return 'Simulated quotes';
  if (s.includes('LIVE') || s.includes('REAL')) return 'Live quotes';
  return source ?? 'Unknown';
}

function SystemDot(props: { label: string; ok: boolean; detail: string; warn?: boolean }) {
  return (
    <div className="rounded-md border border-admin-border/50 bg-admin-bg/30 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-admin-muted">{props.label}</p>
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <span className={cn('inline-block h-2 w-2 rounded-full', props.warn ? 'bg-amber-500' : props.ok ? 'bg-emerald-500' : 'bg-red-500/80')} />
        {props.detail}
      </p>
    </div>
  );
}

function MetricCompact(props: { label: string; value: string; sub?: string; href: string; tone?: 'ok' | 'warn' }) {
  return (
    <Link
      href={props.href}
      className="rounded-lg border border-admin-border/60 bg-[var(--admin-card)] px-3 py-2.5 transition hover:border-violet-500/30 hover:bg-violet-500/[0.04]"
    >
      <p className="text-[9px] uppercase tracking-wide text-admin-muted">{props.label}</p>
      <p className={cn('text-xl font-semibold tabular-nums tracking-tight', props.tone === 'warn' && 'text-amber-300')}>{props.value}</p>
      {props.sub ? <p className="text-[10px] text-admin-muted">{props.sub}</p> : null}
    </Link>
  );
}

function StatLine(props: { label: string; value: string; mono?: boolean; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] text-admin-muted">{props.label}</p>
      <p className={cn('font-medium text-foreground', props.mono && 'font-mono text-xs')}>{props.value}</p>
      {props.hint ? <p className="text-[9px] text-admin-muted">{props.hint}</p> : null}
    </div>
  );
}

function ActionLink(props: { href: string; label: string; icon: typeof Activity; impact?: boolean }) {
  const Icon = props.icon;
  return (
    <Link
      href={props.href}
      className={cn(
        'flex items-center gap-2 rounded-md border px-2.5 py-2 text-xs font-medium transition',
        props.impact
          ? 'border-red-500/30 bg-red-500/5 text-red-100 hover:bg-red-500/10'
          : 'border-admin-border/60 bg-admin-bg/30 text-foreground hover:border-violet-500/30',
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" />
      {props.label}
    </Link>
  );
}
