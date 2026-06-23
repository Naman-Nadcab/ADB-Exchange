'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coins,
  Database,
  Layers,
  Lock,
  Radar,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { ROUTES, SPOT_TRADE_HREF, tradeSpotWithSymbol, walletPath } from '@/lib/routes';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { PublicLayout } from '@/components/layout/PublicLayout';

type ConvertTicker = {
  base_symbol: string;
  price: string;
  change_24h_percent: string;
};

type SpotTicker = {
  symbol: string;
  last_price?: string;
  volume_24h?: string;
  price_change_percent_24h?: string;
  price_change_pct_24h?: string;
};

type SpotMarket = {
  symbol: string;
  base_asset: string;
  quote_asset: string;
  created_at?: string;
  listed_at?: string;
};

type MarketTableRow = {
  symbol: string;
  asset: string;
  price: number;
  change24h: number;
  volume24h: number;
};

type HomeApiState = {
  convertTickers: ConvertTicker[];
  spotTickers: SpotTicker[];
  spotMarkets: SpotMarket[];
  lastUpdatedAt: number | null;
  loading: boolean;
  error: string | null;
};

const REQUIRED_TICKERS = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA', 'DOGE'] as const;

const STATUS_PANELS = [
  { label: 'Spot Engine', latency: '< 2 ms', health: 'Operational' },
  { label: 'Wallets', latency: '< 15 sec', health: 'Operational' },
  { label: 'P2P Escrow', latency: '< 1 sec', health: 'Operational' },
  { label: 'API Gateway', latency: '99.99%', health: 'Operational' },
  { label: 'Withdrawals', latency: '< 4 min', health: 'Operational' },
  { label: 'Deposits', latency: 'Live', health: 'Operational' },
] as const;

const ANNOUNCEMENTS = [
  {
    type: 'New Listing',
    title: 'TON/USDT and ARB/USDT spot pairs are now live.',
    time: '2h ago',
    href: ROUTES.dashboard.announcements,
  },
  {
    type: 'Maintenance',
    title: 'Scheduled wallet maintenance for ETH network at 02:00 UTC.',
    time: '8h ago',
    href: ROUTES.dashboard.announcements,
  },
  {
    type: 'Security Update',
    title: 'Withdrawal anomaly detection upgraded with stricter risk scoring.',
    time: '1d ago',
    href: ROUTES.dashboard.announcements,
  },
  {
    type: 'Platform News',
    title: 'Institutional API throughput increased for low-latency order routing.',
    time: '2d ago',
    href: ROUTES.dashboard.announcements,
  },
] as const;

function num(v: unknown): number {
  const parsed = Number(String(v ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPrice(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '--';
  if (v >= 1000) return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  if (v >= 1) return v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function compact(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return '--';
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(v);
}

function useHomeMarketData() {
  const [state, setState] = useState<HomeApiState>({
    convertTickers: [],
    spotTickers: [],
    spotMarkets: [],
    lastUpdatedAt: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let active = true;
    const base = getApiBaseUrl().replace(/\/$/, '');

    const fetchData = async () => {
      try {
        const [convertRes, tickersRes, marketsRes] = await Promise.allSettled([
          fetch(`${base}/api/v1/convert/market-prices`),
          fetch(`${base}/api/v1/spot/tickers`),
          fetch(`${base}/api/v1/spot/markets`),
        ]);

        const convertJson =
          convertRes.status === 'fulfilled'
            ? await convertRes.value.json().catch(() => null)
            : null;
        const tickersJson =
          tickersRes.status === 'fulfilled'
            ? await tickersRes.value.json().catch(() => null)
            : null;
        const marketsJson =
          marketsRes.status === 'fulfilled'
            ? await marketsRes.value.json().catch(() => null)
            : null;

        const convertData = Array.isArray(convertJson?.data)
          ? (convertJson.data as ConvertTicker[])
          : [];
        const tickersData = Array.isArray(tickersJson?.data)
          ? (tickersJson.data as SpotTicker[])
          : [];
        const marketsData = Array.isArray(marketsJson?.data)
          ? (marketsJson.data as SpotMarket[])
          : [];

        if (!active) return;
        setState({
          convertTickers: convertData,
          spotTickers: tickersData,
          spotMarkets: marketsData,
          lastUpdatedAt: Date.now(),
          loading: false,
          error:
            convertData.length === 0 && tickersData.length === 0
              ? 'Live market feed unavailable.'
              : null,
        });
      } catch {
        if (!active) return;
        setState((prev) => ({
          ...prev,
          loading: false,
          error: 'Unable to load live market feed.',
        }));
      }
    };

    void fetchData();
    const interval = window.setInterval(fetchData, 5000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return state;
}

function useCountUp(target: number, durationMs = 1400): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!Number.isFinite(target) || target <= 0) {
      setValue(0);
      return;
    }
    const start = performance.now();
    let raf = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - (1 - progress) ** 3;
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);

  return value;
}

function StatNumber({
  label,
  target,
  prefix = '',
  suffix = '',
}: {
  label: string;
  target: number;
  prefix?: string;
  suffix?: string;
}) {
  const value = useCountUp(target);
  return (
    <article className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-4 sm:p-5">
      <p className="text-[11px] uppercase tracking-[0.14em] text-[#9CA3AF]">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white sm:text-3xl">
        {prefix}
        {value.toLocaleString('en-US')}
        {suffix}
      </p>
    </article>
  );
}

export default function HomePage() {
  const [marketTab, setMarketTab] = useState<'trending' | 'gainers' | 'losers' | 'new'>('trending');
  const { convertTickers, spotTickers, spotMarkets, lastUpdatedAt, loading, error } = useHomeMarketData();

  const tickerStrip = useMemo(() => {
    const bySymbol = new Map<string, ConvertTicker>();
    convertTickers.forEach((row) => bySymbol.set(String(row.base_symbol || '').toUpperCase(), row));
    const bySpotBase = new Map<string, SpotTicker>();
    spotTickers.forEach((row) => {
      const base = String(row.symbol || '').toUpperCase().split('_')[0];
      if (base) bySpotBase.set(base, row);
    });
    return REQUIRED_TICKERS.map((symbol) => {
      const row = bySymbol.get(symbol);
      const spotRow = bySpotBase.get(symbol);
      return {
        symbol,
        price: num(row?.price) || num(spotRow?.last_price),
        change:
          num(row?.change_24h_percent) ||
          num(spotRow?.price_change_percent_24h ?? spotRow?.price_change_pct_24h),
      };
    });
  }, [convertTickers, spotTickers]);

  const lastSyncLabel = useMemo(() => {
    if (!lastUpdatedAt) return 'Sync pending';
    try {
      return `Last sync ${new Date(lastUpdatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })}`;
    } catch {
      return 'Live sync active';
    }
  }, [lastUpdatedAt]);

  const marketRows = useMemo<MarketTableRow[]>(() => {
    if (!spotTickers.length) return [];
    return spotTickers
      .map((row) => {
        const base = row.symbol?.split('_')?.[0] ?? row.symbol;
        const change = num(
          row.price_change_percent_24h ??
            row.price_change_pct_24h ??
            0
        );
        return {
          symbol: row.symbol,
          asset: base,
          price: num(row.last_price),
          change24h: change,
          volume24h: num(row.volume_24h),
        };
      })
      .filter((row) => row.symbol && Number.isFinite(row.price));
  }, [spotTickers]);

  const marketTableRows = useMemo(() => {
    if (!marketRows.length) return [];
    if (marketTab === 'gainers') return [...marketRows].sort((a, b) => b.change24h - a.change24h).slice(0, 8);
    if (marketTab === 'losers') return [...marketRows].sort((a, b) => a.change24h - b.change24h).slice(0, 8);
    if (marketTab === 'new') {
      const bySymbol = new Map(spotMarkets.map((m) => [m.symbol, m]));
      return [...marketRows]
        .sort((a, b) => {
          const ta = Date.parse(bySymbol.get(a.symbol)?.listed_at || bySymbol.get(a.symbol)?.created_at || '1970-01-01');
          const tb = Date.parse(bySymbol.get(b.symbol)?.listed_at || bySymbol.get(b.symbol)?.created_at || '1970-01-01');
          return tb - ta;
        })
        .slice(0, 8);
    }
    return [...marketRows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8);
  }, [marketRows, marketTab, spotMarkets]);

  const totalVolume = useMemo(
    () => marketRows.reduce((acc, row) => acc + row.volume24h, 0),
    [marketRows]
  );
  const pairsCount = spotMarkets.length || marketRows.length;
  const btcPrice = tickerStrip.find((t) => t.symbol === 'BTC')?.price ?? 0;
  const topMover = marketRows[0];

  const sparklinePath = useMemo(() => {
    const width = 320;
    const height = 120;
    const points = Array.from({ length: 28 }).map((_, i) => {
      const drift = Math.sin(i / 3) * 9 + Math.cos(i / 4) * 5 + i * 0.7;
      const y = 92 - drift;
      const x = (i / 27) * width;
      return { x, y };
    });
    return points
      .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`)
      .join(' ');
  }, []);

  return (
    <PublicLayout className="bg-[#05070B] text-white" contentClassName="">

      <section className="overflow-hidden border-b border-[#F5B8001F] bg-[#0B0F16] py-2">
        <div className="mx-auto mb-2 flex max-w-[1320px] items-center justify-between px-4 text-[11px] sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Live market stream
          </span>
          <span className="text-[#9CA3AF]">{lastSyncLabel}</span>
        </div>
        <div className="overflow-hidden">
          <div className="marquee-track">
          {[...tickerStrip, ...tickerStrip].map((row, idx) => {
            const up = row.change >= 0;
            return (
              <div key={`${row.symbol}-${idx}`} className="inline-flex items-center gap-3 rounded-md border border-[#F5B8001F] bg-[#0D1118] px-3 py-2 text-xs">
                <CoinIcon symbol={row.symbol} size={18} />
                <span className="font-semibold text-white">{row.symbol}</span>
                <span className="text-[#9CA3AF]">${formatPrice(row.price)}</span>
                <span className={up ? 'text-emerald-400' : 'text-rose-400'}>
                  {up ? <ChevronUp className="mr-0.5 inline h-3 w-3" /> : <ChevronDown className="mr-0.5 inline h-3 w-3" />}
                  {Math.abs(row.change).toFixed(2)}%
                </span>
              </div>
            );
          })}
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-[1320px] space-y-16 px-4 py-10 sm:px-6 lg:space-y-20 lg:px-8 lg:py-14">
        <section className="home-hero-section grid gap-8 rounded-2xl border border-[#F5B8001F] p-5 sm:p-6 lg:grid-cols-[1.05fr_0.95fr] lg:p-8">
          <div className="space-y-7">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#F5B8001F] bg-[#0D1118] px-4 py-1.5 text-[11px] uppercase tracking-[0.16em] text-[#F5B800]">
              <ShieldCheck className="h-3.5 w-3.5" />
              Tier-0 Exchange Infrastructure
            </span>
            <h1 className="max-w-2xl text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
              Secure liquidity,
              <span className="block text-[#F5B800]">professional execution,</span>
              institutional trust.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-[#9CA3AF] sm:text-lg">
              Methereum delivers spot, P2P, and treasury-grade account protection with real-time market access,
              resilient matching, and transparent infrastructure controls.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href={ROUTES.signup} className="inline-flex items-center gap-2 rounded-lg bg-[#F5B800] px-6 py-3 text-sm font-semibold text-[#05070B] transition hover:bg-[#FFD54A]">
                Create Account
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href={walletPath.depositCrypto} className="inline-flex items-center gap-2 rounded-lg border border-[#F5B8001F] bg-[#0D1118] px-6 py-3 text-sm font-semibold text-white transition hover:border-[#F5B80066]">
                First Deposit Guide
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: 'Security Layer', value: 'Multi-Sig + 2FA' },
                { label: 'Execution', value: '<2ms avg' },
                { label: 'Availability', value: '99.99% uptime' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#F5B8001F] bg-[#0D1118] p-3">
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[#9CA3AF]">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-4 sm:p-5">
            <div className="flex items-center justify-between border-b border-[#F5B8001F] pb-3">
              <div>
                <p className="text-sm font-semibold">Live Trading Terminal</p>
                <p className="text-xs text-[#9CA3AF]">Depth, order flow, and market pulse</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Connected
              </span>
            </div>
            <div className="mt-4 grid gap-4">
              <div className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>BTC/USDT</span>
                  <span>${formatPrice(btcPrice)}</span>
                </div>
                <svg viewBox="0 0 320 120" className="h-28 w-full">
                  <path d={sparklinePath} fill="none" stroke="#F5B800" strokeWidth="2.5" />
                  <path d={`${sparklinePath} L 320 120 L 0 120 Z`} fill="url(#chartGlow)" opacity="0.2" />
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F5B800" />
                      <stop offset="100%" stopColor="#F5B800" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">Order Flow</p>
                  {(marketRows.slice(0, 4).length ? marketRows.slice(0, 4) : [{ symbol: 'BTC_USDT', change24h: 0.35 } as MarketTableRow]).map((row) => (
                    <div key={row.symbol} className="mb-1.5 flex items-center justify-between text-xs">
                      <span className="text-[#9CA3AF]">{row.symbol.replace('_', '/')}</span>
                      <span className={row.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                        {row.change24h >= 0 ? '+' : ''}
                        {row.change24h.toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-3">
                  <p className="mb-2 text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">Depth Preview</p>
                  {[74, 62, 55, 41].map((level, i) => (
                    <div key={level} className="mb-2">
                      <div className="mb-1 flex items-center justify-between text-[10px] text-[#9CA3AF]">
                        <span>L{i + 1}</span>
                        <span>{level}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[#F5B800]" style={{ width: `${level}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-3 text-xs text-[#9CA3AF]">
                <span className="text-white">Market Insight: </span>
                {topMover?.symbol ? `${topMover.symbol.replace('_', '/')} currently leads with ${compact(topMover.volume24h)} notional volume.` : 'Market feed initializing.'}
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatNumber label="24H Volume" target={Math.max(12_000_000, Math.round(totalVolume))} prefix="$" />
          <StatNumber label="Registered Users" target={1823400} />
          <StatNumber label="Trading Pairs" target={Math.max(96, pairsCount)} />
          <StatNumber label="System Uptime" target={99} suffix=".99%" />
          <StatNumber label="Execution Speed" target={2} suffix="ms" />
        </section>

        <section className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-5 sm:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-semibold sm:text-3xl">Market Overview</h2>
              <p className="mt-1 text-sm text-[#9CA3AF]">Professional ranking panel with execution-first actions.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'trending', label: 'Trending' },
                { id: 'gainers', label: 'Top Gainers' },
                { id: 'losers', label: 'Top Losers' },
                { id: 'new', label: 'New Listings' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMarketTab(tab.id as 'trending' | 'gainers' | 'losers' | 'new')}
                  className={`rounded-lg px-3 py-2 text-xs font-semibold uppercase tracking-[0.1em] transition ${
                    marketTab === tab.id
                      ? 'bg-[#F5B800] text-[#05070B]'
                      : 'border border-[#F5B8001F] bg-[#05070B] text-[#9CA3AF] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">
                <tr>
                  <th className="pb-3">Asset</th>
                  <th className="pb-3">Price</th>
                  <th className="pb-3">24H</th>
                  <th className="pb-3">Volume</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {(marketTableRows.length ? marketTableRows : [{ symbol: 'BTC_USDT', asset: 'BTC', price: 0, change24h: 0, volume24h: 0 }]).map((row) => (
                  <tr key={row.symbol} className="border-t border-[#F5B8001A]">
                    <td className="py-3">
                      <p className="font-medium">{row.asset}</p>
                      <p className="text-xs text-[#9CA3AF]">{row.symbol.replace('_', '/')}</p>
                    </td>
                    <td className="py-3 tabular-nums">${formatPrice(row.price)}</td>
                    <td className={`py-3 tabular-nums ${row.change24h >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.change24h >= 0 ? '+' : ''}
                      {row.change24h.toFixed(2)}%
                    </td>
                    <td className="py-3 tabular-nums">${compact(row.volume24h)}</td>
                    <td className="py-3 text-right">
                      <Link href={tradeSpotWithSymbol(row.symbol)} className="inline-flex items-center rounded-md bg-[#F5B800] px-3 py-1.5 text-xs font-semibold text-[#05070B] hover:bg-[#FFD54A]">
                        Trade
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-5">
            <h2 className="text-2xl font-semibold sm:text-3xl">Trading Ecosystem</h2>
            <p className="mt-1 text-sm text-[#9CA3AF]">Everything required for retail, pro, and institutional execution.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BarChart3, title: 'Spot', desc: 'High-liquidity matching across majors and alt pairs.', href: SPOT_TRADE_HREF },
              { icon: Users, title: 'P2P', desc: 'Escrow-backed fiat rails with dispute protection.', href: ROUTES.p2p },
              { icon: Coins, title: 'Earn', desc: 'Flexible and fixed-yield crypto strategies.', href: ROUTES.earn },
              { icon: Layers, title: 'Convert', desc: 'Instant conversion with smart routing.', href: walletPath.convert },
              { icon: Bot, title: 'API', desc: 'Low-latency REST and WebSocket execution.', href: ROUTES.dashboard.api },
              { icon: ShieldCheck, title: 'Security Center', desc: '2FA, anti-phishing, sessions, and whitelist controls.', href: ROUTES.dashboard.security },
              { icon: Radar, title: 'Future Products', desc: 'Derivatives, institutional custody, and cross-margin.', href: ROUTES.dashboard.preferences },
              { icon: Wallet, title: 'Treasury Tools', desc: 'Unified asset, transfer, and settlement visibility.', href: ROUTES.wallet },
            ].map((card) => (
              <Link key={card.title} href={card.href} className="group rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-5 transition hover:border-[#F5B80066]">
                <card.icon className="h-5 w-5 text-[#F5B800]" />
                <h3 className="mt-3 text-lg font-semibold">{card.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#9CA3AF]">{card.desc}</p>
                <span className="mt-4 inline-flex items-center text-xs font-semibold uppercase tracking-[0.1em] text-[#F5B800]">
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { icon: Shield, title: 'Security', text: 'Layered defense with continuous threat intelligence and strict access controls.' },
            { icon: Zap, title: 'Execution', text: 'Ultra-fast order paths tuned for volatility-heavy market windows.' },
            { icon: Activity, title: 'Reliability', text: 'Fault-tolerant services with transparent service health telemetry.' },
            { icon: Database, title: 'Liquidity', text: 'Deep order books with efficient spread management for key pairs.' },
            { icon: Sparkles, title: 'User Experience', text: 'Low-friction onboarding from account creation to first trade.' },
            { icon: Server, title: 'Infrastructure', text: 'Scalable architecture designed for peak-cycle throughput.' },
          ].map((f) => (
            <article key={f.title} className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-5">
              <f.icon className="h-5 w-5 text-[#F5B800]" />
              <h3 className="mt-3 text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[#9CA3AF]">{f.text}</p>
            </article>
          ))}
        </section>

        <section className="home-cta-trust grid gap-5 rounded-2xl border border-[#F5B80033] p-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl border border-[#F5B80033] bg-[#0D1118] p-6">
            <p className="text-xs uppercase tracking-[0.12em] text-[#F5B800]">Security Architecture</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Institutional-grade protection by design.</h2>
            <p className="mt-3 text-sm leading-relaxed text-[#9CA3AF]">
              Asset custody, transaction controls, and account defense run across independent layers with active monitoring and risk scoring.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                'Cold Storage',
                'Multi-Sig Authorization',
                '2FA Enforcement',
                'Anti-Phishing Codes',
                'Withdrawal Protection',
                '24/7 Monitoring',
                'Risk Engine',
                'Session Control',
              ].map((item) => (
                <div key={item} className="inline-flex items-center gap-2 rounded-lg border border-[#F5B8001F] bg-[#05070B] px-3 py-2 text-sm">
                  <BadgeCheck className="h-4 w-4 text-[#F5B800]" />
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-6">
            <h3 className="text-sm uppercase tracking-[0.12em] text-[#9CA3AF]">Security Dashboard Visualization</h3>
            <div className="mt-4 space-y-4">
              {[
                { name: 'Wallet Risk Score', value: 22, healthy: true },
                { name: 'Withdrawal Risk Score', value: 31, healthy: true },
                { name: 'Behavioral Anomaly', value: 17, healthy: true },
                { name: 'Infrastructure Integrity', value: 96, healthy: true },
              ].map((metric) => (
                <div key={metric.name}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-[#9CA3AF]">{metric.name}</span>
                    <span className={metric.healthy ? 'text-emerald-400' : 'text-rose-400'}>
                      {metric.value}
                      {metric.name.includes('Integrity') ? '%' : '/100'}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-white/10">
                    <div className={`h-full rounded-full ${metric.name.includes('Integrity') ? 'bg-[#F5B800]' : 'bg-emerald-400'}`} style={{ width: `${metric.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="text-xs uppercase tracking-[0.12em] text-[#F5B800]">Earn With Methereum</p>
              <h2 className="mt-2 text-2xl font-semibold sm:text-3xl">Flexible staking with liquidity-conscious reward design.</h2>
              <p className="mt-3 text-sm text-[#9CA3AF]">
                Earn from supported assets with compounding options while preserving transfer and settlement flexibility.
              </p>
              <Link href={ROUTES.earn} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[#F5B800] px-5 py-2.5 text-sm font-semibold text-[#05070B] hover:bg-[#FFD54A]">
                Explore Earn
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Flexible Staking', value: 'Up to 14.2% APY' },
                { label: 'Supported Assets', value: 'BTC, ETH, SOL, USDT' },
                { label: 'Compounding', value: 'Daily Accrual' },
                { label: 'Liquidity Access', value: 'Instant Unstake*' },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-4">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#9CA3AF]">{item.label}</p>
                  <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold sm:text-3xl">System Status</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              All Systems Operational
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATUS_PANELS.map((panel) => (
              <div key={panel.label} className="rounded-xl border border-[#F5B8001F] bg-[#05070B] p-4">
                <p className="text-sm font-medium text-white">{panel.label}</p>
                <div className="mt-2 flex items-center justify-between text-xs text-[#9CA3AF]">
                  <span>{panel.latency}</span>
                  <span className="text-emerald-400">{panel.health}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001F] bg-[#0D1118] p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold sm:text-3xl">Announcements</h2>
            <Link href={ROUTES.dashboard.announcements} className="text-xs uppercase tracking-[0.1em] text-[#F5B800] hover:text-[#FFD54A]">
              View all
            </Link>
          </div>
          <div className="space-y-3">
            {ANNOUNCEMENTS.map((item) => (
              <Link key={item.title} href={item.href} className="block rounded-xl border border-[#F5B8001F] bg-[#05070B] p-4 transition hover:border-[#F5B80066]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-[0.12em] text-[#F5B800]">{item.type}</p>
                  <p className="inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
                    <Clock3 className="h-3 w-3" />
                    {item.time}
                  </p>
                </div>
                <p className="mt-2 text-sm text-white">{item.title}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-cta-confidence rounded-2xl border border-[#F5B80033] p-7 text-center">
          <p className="text-xs uppercase tracking-[0.14em] text-[#F5B800]">Final Conversion</p>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">Trade with confidence from day one.</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-[#9CA3AF] sm:text-base">
            Open your account, activate protection layers, and start with spot or P2P using a security-first exchange workflow.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href={ROUTES.signup} className="inline-flex items-center gap-2 rounded-lg bg-[#F5B800] px-6 py-3 text-sm font-semibold text-[#05070B] hover:bg-[#FFD54A]">
              Create Free Account
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href={ROUTES.login} className="inline-flex items-center rounded-lg border border-[#F5B8001F] bg-[#05070B] px-6 py-3 text-sm font-semibold text-white hover:border-[#F5B80066]">
              Existing User Login
            </Link>
          </div>
        </section>
      </main>

      <style jsx global>{`
        .home-hero-section {
          background-image:
            linear-gradient(112deg, rgba(5, 7, 11, 0.8) 0%, rgba(5, 7, 11, 0.72) 44%, rgba(5, 7, 11, 0.66) 100%),
            url('/images/home-bg/hero-mobile.png');
          background-size: cover;
          background-position: center right;
          background-repeat: no-repeat;
          box-shadow: inset 0 0 0 1px rgba(245, 184, 0, 0.06);
        }
        .home-cta-trust {
          background-image: linear-gradient(108deg, rgba(8, 11, 17, 0.88) 0%, rgba(8, 11, 17, 0.78) 45%, rgba(8, 11, 17, 0.72) 100%);
          background-size: cover;
          background-position: center right;
          background-repeat: no-repeat;
        }
        .home-cta-confidence {
          background-image: linear-gradient(108deg, rgba(8, 11, 17, 0.9) 0%, rgba(8, 11, 17, 0.8) 45%, rgba(8, 11, 17, 0.72) 100%);
          background-size: cover;
          background-position: center right;
          background-repeat: no-repeat;
        }
        @media (min-width: 768px) {
          .home-cta-trust {
            background-image:
              linear-gradient(108deg, rgba(8, 11, 17, 0.84) 0%, rgba(8, 11, 17, 0.74) 45%, rgba(8, 11, 17, 0.7) 100%),
              url('/images/home-bg/cta-trust-mobile.png');
          }
          .home-cta-confidence {
            background-image:
              linear-gradient(108deg, rgba(8, 11, 17, 0.86) 0%, rgba(8, 11, 17, 0.76) 45%, rgba(8, 11, 17, 0.7) 100%),
              url('/images/home-bg/cta-confidence-mobile.png');
          }
        }
        @media (min-width: 1024px) {
          .home-hero-section {
            background-image:
              linear-gradient(110deg, rgba(5, 7, 11, 0.82) 0%, rgba(5, 7, 11, 0.7) 46%, rgba(5, 7, 11, 0.62) 100%),
              url('/images/home-bg/hero-desktop.png');
          }
          .home-cta-trust {
            background-image:
              linear-gradient(110deg, rgba(8, 11, 17, 0.84) 0%, rgba(8, 11, 17, 0.72) 44%, rgba(8, 11, 17, 0.64) 100%),
              url('/images/home-bg/cta-trust-desktop.png');
          }
          .home-cta-confidence {
            background-image:
              linear-gradient(110deg, rgba(8, 11, 17, 0.86) 0%, rgba(8, 11, 17, 0.74) 44%, rgba(8, 11, 17, 0.64) 100%),
              url('/images/home-bg/cta-confidence-desktop.png');
          }
        }
        @media (prefers-reduced-data: reduce) {
          .home-hero-section,
          .home-cta-trust,
          .home-cta-confidence {
            background-image: linear-gradient(112deg, rgba(8, 11, 17, 0.92) 0%, rgba(8, 11, 17, 0.86) 50%, rgba(8, 11, 17, 0.8) 100%);
          }
        }
        .marquee-track {
          display: flex;
          gap: 0.75rem;
          width: max-content;
          animation: home-marquee 28s linear infinite;
          padding-inline: 1rem;
        }
        @keyframes home-marquee {
          from {
            transform: translateX(0);
          }
          to {
            transform: translateX(-50%);
          }
        }
      `}</style>

      {error ? (
        <div className="fixed bottom-3 right-3 z-50 max-w-xs rounded-lg border border-[#F5B8001F] bg-[#0D1118] px-3 py-2 text-xs text-[#9CA3AF]">
          Live feed notice: {error}
        </div>
      ) : null}

      {loading ? (
        <div className="fixed bottom-3 left-3 z-50 inline-flex items-center gap-1 rounded-full border border-[#F5B8001F] bg-[#0D1118] px-3 py-1 text-[11px] text-[#9CA3AF]">
          <Bell className="h-3 w-3 text-[#F5B800]" />
          syncing live market data
        </div>
      ) : null}
    </PublicLayout>
  );
}
