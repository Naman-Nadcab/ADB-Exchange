'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { tradeSpotWithSymbol } from '@/lib/routes';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { CoinIcon } from '@/components/ui/CoinIcon';
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BarChart3,
  Brain,
  Factory,
  Gamepad2,
  Gem,
  Globe2,
  Landmark,
  Layers,
  Radar,
  RefreshCw,
  Search,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Triangle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';

type Market = {
  id: string;
  symbol: string;
  base_asset: string;
  quote_asset: string;
  created_at?: string;
  listed_at?: string;
};

type SpotTickerRow = {
  symbol: string;
  last_price: string | null;
  high_24h: string | null;
  low_24h: string | null;
  volume_24h: string;
  change_pct?: number | null;
  change_24h_percent?: number | null;
  price_change_percent_24h?: string | number | null;
};

type EnrichedMarket = {
  rank: number;
  symbol: string;
  asset: string;
  quote: string;
  price: number;
  change24h: number;
  change7d: number;
  volume24h: number;
  marketCap: number;
  liquidity: number;
  listedTs: number;
};

type MoversTab = 'trending' | 'gainers' | 'losers' | 'volume' | 'new';
type Sector = 'AI' | 'Meme' | 'Layer1' | 'Layer2' | 'Gaming' | 'RWA' | 'DePIN';
type NewsPanel = 'latest' | 'announcements' | 'listings' | 'pulse';
type TableSort =
  | 'rank'
  | 'asset'
  | 'price'
  | 'change24h'
  | 'change7d'
  | 'volume24h'
  | 'marketCap'
  | 'liquidity';
type SortDir = 'asc' | 'desc';

const HEATMAP_LIMIT = 18;
const ROW_HEIGHT = 62;
const TABLE_VIEWPORT_HEIGHT = 560;
const OVERSCAN = 8;

const SECTOR_MAP: Record<Sector, string[]> = {
  AI: ['FET', 'RENDER', 'WLD', 'GRT', 'INJ'],
  Meme: ['DOGE', 'SHIB', 'PEPE', 'BONK', 'FLOKI', 'WIF'],
  Layer1: ['BTC', 'ETH', 'SOL', 'ADA', 'AVAX', 'DOT', 'ATOM', 'SUI', 'SEI'],
  Layer2: ['ARB', 'OP', 'MATIC', 'IMX'],
  Gaming: ['IMX', 'AXS', 'SAND', 'MANA'],
  RWA: ['ONDO', 'MKR', 'LINK'],
  DePIN: ['FIL', 'AR', 'RENDER', 'THETA'],
};

const SECTOR_ICON: Record<Sector, LucideIcon> = {
  AI: Brain,
  Meme: Sparkles,
  Layer1: Layers,
  Layer2: Triangle,
  Gaming: Gamepad2,
  RWA: Landmark,
  DePIN: Factory,
};

const MARKET_INTEL_CACHE_HINT = 'Server cache 300s';

type MarketIntelligenceSymbol = {
  symbol: string;
  asset: string;
  change_7d_pct: number | null;
  market_cap: number | null;
  liquidity_score: number | null;
  sparkline: number[];
};

type MarketIntelligencePayload = {
  symbols: Record<string, MarketIntelligenceSymbol>;
  sentiment: { fear_greed_index: number; fear_greed_label: string; source: string };
};

type AnnouncementRow = {
  id?: string;
  title: string;
  type?: string;
  summary?: string;
  published_at?: string;
  created_at?: string;
};

const fmtUsd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
});

const fmtCompact = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 2,
});

function formatUsdCompact(n: number, emptyLabel: string): string {
  if (!Number.isFinite(n) || n <= 0) return emptyLabel;
  return `$${fmtCompact.format(n)}`;
}

function formatVolCompact(n: number, emptyLabel: string): string {
  if (!Number.isFinite(n) || n <= 0) return emptyLabel;
  return `Vol $${fmtCompact.format(n)}`;
}

function n(v: unknown): number {
  const parsed = Number(String(v ?? 0));
  return Number.isFinite(parsed) ? parsed : 0;
}

function hashSeed(symbol: string): number {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return h || 1;
}

function formatAgo(iso?: string): string {
  if (!iso) return '—';
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

function pctClass(v: number): string {
  if (v > 0) return 'text-emerald-400';
  if (v < 0) return 'text-rose-400';
  return 'text-[#9CA3AF]';
}

function fmtPrice(v: number): string {
  if (v >= 1000) return fmtUsd.format(v);
  if (v >= 1) return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function SparklineMini({ closes, value }: { closes: number[]; value: number }) {
  const path = useMemo(() => {
    const points = closes.length >= 2 ? closes : [];
    if (points.length < 2) return '';
    const width = 96;
    const height = 34;
    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;
    let d = '';
    for (let i = 0; i < points.length; i++) {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((points[i]! - min) / span) * (height - 4) - 2;
      d += `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)} `;
    }
    return d.trim();
  }, [closes]);

  if (!path) {
    return <div className="h-9 w-24 rounded bg-white/5" aria-hidden />;
  }

  return (
    <svg viewBox="0 0 96 34" className="h-9 w-24">
      <path
        d={path}
        fill="none"
        stroke={value >= 0 ? '#22C55E' : '#F43F5E'}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF] hover:text-white"
    >
      {label}
      {active ? (
        dir === 'desc' ? <ArrowDown className="h-3 w-3 text-[#F5B800]" /> : <ArrowUp className="h-3 w-3 text-[#F5B800]" />
      ) : (
        <span className="h-3 w-3 rounded-full bg-white/10" />
      )}
    </button>
  );
}

type RotationStatusKey = 'balanced' | 'highRotation' | 'riskOn' | 'riskOff' | 'mixed';

export default function MarketsPage() {
  const t = useTranslations('markets');
  const [markets, setMarkets] = useState<Market[]>([]);
  const [tickers, setTickers] = useState<Map<string, SpotTickerRow>>(new Map());
  const [intelligence, setIntelligence] = useState<MarketIntelligencePayload | null>(null);
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [moversTab, setMoversTab] = useState<MoversTab>('trending');
  const [newsPanel, setNewsPanel] = useState<NewsPanel>('latest');
  const [sector, setSector] = useState<Sector>('AI');
  const [search, setSearch] = useState('');
  const [quoteFilter, setQuoteFilter] = useState<'ALL' | string>('ALL');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [changeSide, setChangeSide] = useState<'all' | 'positive' | 'negative'>('all');
  const [sortKey, setSortKey] = useState<TableSort>('marketCap');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [scrollTop, setScrollTop] = useState(0);
  const tableRef = useRef<HTMLDivElement | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mRes, tRes, iRes, aRes] = await Promise.all([
        api.get<Market[]>('/api/v1/spot/markets', { skipAuth: true, notifyOnError: false }),
        api.get<SpotTickerRow[]>('/api/v1/spot/tickers', { skipAuth: true, notifyOnError: false }),
        api.get<MarketIntelligencePayload>('/api/v1/spot/markets/intelligence', { skipAuth: true, notifyOnError: false }),
        api.get<{ announcements?: AnnouncementRow[] }>('/api/v1/user/announcements?limit=8', { skipAuth: true, notifyOnError: false }),
      ]);
      if (!mRes.success || !Array.isArray(mRes.data)) {
        setError(mRes.error?.message ?? t('errors.loadListFailed'));
        setMarkets([]);
      } else {
        setMarkets(mRes.data);
      }
      if (tRes.success && Array.isArray(tRes.data)) {
        setTickers(new Map(tRes.data.map((row) => [row.symbol, row])));
      }
      if (iRes.success && iRes.data) {
        setIntelligence(iRes.data);
      }
      if (aRes.success && aRes.data?.announcements) {
        setAnnouncements(aRes.data.announcements);
      }
    } catch {
      setError(t('errors.network'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const refreshTickers = useCallback(async () => {
    try {
      const tRes = await api.get<SpotTickerRow[]>('/api/v1/spot/tickers', { skipAuth: true, notifyOnError: false });
      if (tRes.success && Array.isArray(tRes.data)) {
        setTickers(new Map(tRes.data.map((row) => [row.symbol, row])));
      }
    } catch {
      // keep previous snapshot
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refreshTickers();
    }, 5000);
    return () => window.clearInterval(id);
  }, [refreshTickers]);

  const rows = useMemo<EnrichedMarket[]>(() => {
    const merged = markets
      .map((m) => {
        const t = tickers.get(m.symbol);
        const price = n(t?.last_price);
        const change24h = n(
          t?.change_pct ??
            t?.change_24h_percent ??
            t?.price_change_percent_24h
        );
        const volume24h = n(t?.volume_24h);
        const intel = intelligence?.symbols?.[m.symbol.toUpperCase()];
        const change7d = intel?.change_7d_pct ?? 0;
        const marketCap = intel?.market_cap ?? 0;
        const liquidity = intel?.liquidity_score ?? 0;
        const listedTs = Date.parse(m.listed_at ?? m.created_at ?? '1970-01-01');

        return {
          rank: 0,
          symbol: m.symbol,
          asset: m.base_asset,
          quote: m.quote_asset,
          price,
          change24h,
          change7d,
          volume24h,
          marketCap,
          liquidity,
          listedTs: Number.isFinite(listedTs) ? listedTs : 0,
        };
      })
      .filter((row) => row.price > 0);

    const sortedByCap = [...merged].sort((a, b) => b.marketCap - a.marketCap);
    return sortedByCap.map((row, i) => ({ ...row, rank: i + 1 }));
  }, [markets, tickers, intelligence]);

  const quoteOptions = useMemo(
    () => ['ALL', ...Array.from(new Set(rows.map((r) => r.quote))).sort()],
    [rows]
  );

  const globalMetrics = useMemo(() => {
    const totalCap = rows.reduce((acc, row) => acc + row.marketCap, 0);
    const totalVol = rows.reduce((acc, row) => acc + row.volume24h, 0);
    const btcCap = rows.find((r) => r.asset === 'BTC')?.marketCap ?? 0;
    const btcDominance = totalCap > 0 && btcCap > 0 ? (btcCap / totalCap) * 100 : 0;
    const fearGreed = intelligence?.sentiment?.fear_greed_index ?? 50;
    return {
      marketCap: totalCap,
      volume24h: totalVol,
      btcDominance,
      btcDominanceKnown: btcCap > 0 && totalCap > 0,
      fearGreed,
      assetsListed: rows.length,
    };
  }, [rows, intelligence?.sentiment?.fear_greed_index]);

  const announcementCards = useMemo(
    () =>
      announcements.slice(0, 6).map((item) => ({
        title: item.title,
        badge: item.type || 'Announcement',
        ago: formatAgo(item.published_at ?? item.created_at),
      })),
    [announcements]
  );

  const exchangeAnnouncements = useMemo(
    () =>
      announcements.slice(0, 4).map((item) => ({
        title: item.title,
        priority: item.type || 'Announcement',
        ago: formatAgo(item.published_at ?? item.created_at),
      })),
    [announcements]
  );
  const trendingCards = useMemo(
    () => [...rows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8),
    [rows]
  );

  const activePairs = useMemo(
    () => [...rows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 8),
    [rows]
  );

  const moverRows = useMemo(() => {
    if (moversTab === 'gainers') return [...rows].sort((a, b) => b.change24h - a.change24h).slice(0, 10);
    if (moversTab === 'losers') return [...rows].sort((a, b) => a.change24h - b.change24h).slice(0, 10);
    if (moversTab === 'volume') return [...rows].sort((a, b) => b.volume24h - a.volume24h).slice(0, 10);
    if (moversTab === 'new') return [...rows].sort((a, b) => b.listedTs - a.listedTs).slice(0, 10);
    return [...rows]
      .sort((a, b) => Math.abs(b.change24h) + b.volume24h / 1_000_000 - (Math.abs(a.change24h) + a.volume24h / 1_000_000))
      .slice(0, 10);
  }, [rows, moversTab]);

  const heatmapRows = useMemo(
    () => [...rows].sort((a, b) => b.marketCap - a.marketCap).slice(0, HEATMAP_LIMIT),
    [rows]
  );

  const sectorRows = useMemo(() => {
    return (Object.keys(SECTOR_MAP) as Sector[]).map((name) => {
      const symbols = SECTOR_MAP[name];
      const list = rows.filter((r) => symbols.includes(r.asset));
      const avg24h = list.length ? list.reduce((acc, row) => acc + row.change24h, 0) / list.length : 0;
      const vol = list.reduce((acc, row) => acc + row.volume24h, 0);
      return { name, avg24h, volume: vol, count: list.length };
    });
  }, [rows]);

  const selectedSectorAssets = useMemo(() => {
    const symbols = SECTOR_MAP[sector];
    return rows
      .filter((r) => symbols.includes(r.asset))
      .sort((a, b) => b.volume24h - a.volume24h)
      .slice(0, 8);
  }, [rows, sector]);

  const sectorLeaders = useMemo(() => {
    return (Object.keys(SECTOR_MAP) as Sector[])
      .map((name) => {
        const symbols = SECTOR_MAP[name];
        const leader = rows
          .filter((r) => symbols.includes(r.asset))
          .sort((a, b) => b.change24h - a.change24h)[0];
        if (!leader) return null;
        return {
          sector: name,
          asset: leader.asset,
          symbol: leader.symbol,
          change24h: leader.change24h,
          volume24h: leader.volume24h,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => b.change24h - a.change24h);
  }, [rows]);

  const totalSectorVolume = useMemo(
    () => sectorRows.reduce((acc, row) => acc + row.volume, 0),
    [sectorRows]
  );

  const sectorDominanceRows = useMemo(() => {
    return [...sectorRows]
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        share: totalSectorVolume > 0 ? (row.volume / totalSectorVolume) * 100 : 0,
      }));
  }, [sectorRows, totalSectorVolume]);

  const strongestSector = useMemo(
    () => [...sectorRows].sort((a, b) => b.avg24h - a.avg24h)[0] ?? null,
    [sectorRows]
  );

  const weakestSector = useMemo(
    () => [...sectorRows].sort((a, b) => a.avg24h - b.avg24h)[0] ?? null,
    [sectorRows]
  );

  const rotationScore = useMemo(() => {
    if (!strongestSector || !weakestSector) return 50;
    const spread = strongestSector.avg24h - weakestSector.avg24h;
    return Math.max(0, Math.min(100, 50 + spread * 8));
  }, [strongestSector, weakestSector]);

  const rotationStatusKey = useMemo((): RotationStatusKey => {
    if (!strongestSector || !weakestSector) return 'balanced';
    if (strongestSector.avg24h > 1 && weakestSector.avg24h < -0.6) return 'highRotation';
    if (strongestSector.avg24h > 0.4 && weakestSector.avg24h < 0) return 'riskOn';
    if (strongestSector.avg24h <= 0 && weakestSector.avg24h < -0.8) return 'riskOff';
    return 'mixed';
  }, [strongestSector, weakestSector]);
  const rotationStatus = t(`sectors.rotation.${rotationStatusKey}`);

  const tableRows = useMemo(() => {
    let list = rows;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (row) =>
          row.symbol.toLowerCase().includes(q) ||
          row.asset.toLowerCase().includes(q) ||
          row.quote.toLowerCase().includes(q)
      );
    }
    if (quoteFilter !== 'ALL') list = list.filter((row) => row.quote === quoteFilter);
    const min = n(minPrice);
    const max = n(maxPrice);
    if (min > 0) {
      list = list.filter(function (item) {
        return item.price >= min;
      });
    }
    if (max > 0) {
      list = list.filter(function (item) {
        return item.price <= max;
      });
    }
    if (changeSide === 'positive') {
      list = list.filter(function (item) {
        return item.change24h > 0;
      });
    }
    if (changeSide === 'negative') {
      list = list.filter(function (item) {
        return item.change24h < 0;
      });
    }

    const mul = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortKey === 'asset') return mul * a.asset.localeCompare(b.asset);
      return mul * (a[sortKey] - b[sortKey]);
    });
  }, [rows, search, quoteFilter, minPrice, maxPrice, changeSide, sortKey, sortDir]);

  const newListings = useMemo(
    () => [...rows].sort((a, b) => b.listedTs - a.listedTs).slice(0, 6),
    [rows]
  );

  const bullishPct = useMemo(() => {
    if (!rows.length) return 0;
    return (rows.filter((r) => r.change24h > 0).length / rows.length) * 100;
  }, [rows]);

  const bearishPct = useMemo(() => Math.max(0, 100 - bullishPct), [bullishPct]);

  const totalRows = tableRows.length;
  const visibleCount = Math.ceil(TABLE_VIEWPORT_HEIGHT / ROW_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalRows, startIndex + visibleCount + OVERSCAN * 2);
  const visibleRows = tableRows.slice(startIndex, endIndex);
  const topSpacer = startIndex * ROW_HEIGHT;
  const bottomSpacer = Math.max(0, (totalRows - endIndex) * ROW_HEIGHT);

  useEffect(() => {
    setScrollTop(0);
    if (tableRef.current) tableRef.current.scrollTop = 0;
  }, [search, quoteFilter, minPrice, maxPrice, changeSide, sortKey, sortDir]);

  const onSort = (key: TableSort) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'));
      return;
    }
    setSortKey(key);
    setSortDir(key === 'asset' ? 'asc' : 'desc');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#05070B] p-6 text-white">
        <div className="mx-auto max-w-[1400px] space-y-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#05070B] p-6">
        <div className="mx-auto max-w-[900px] pt-10">
          <ErrorState title={t('errors.feedUnavailable')} message={error} onRetry={() => void fetchAll()} />
        </div>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="min-h-screen bg-[#05070B] p-6">
        <div className="mx-auto max-w-[900px] pt-10">
          <EmptyState title={t('empty.noDataTitle')} description={t('empty.noDataDesc')} icon={BarChart3} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070B] text-white">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
          <p className="max-w-3xl text-sm text-[#AEB6C4]">{t('description')}</p>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { label: t('metrics.marketCap'), value: formatUsdCompact(globalMetrics.marketCap, '—'), icon: Globe2 },
            { label: t('metrics.volume24h'), value: formatUsdCompact(globalMetrics.volume24h, t('metrics.noExchangePrints')), icon: Activity },
            { label: t('metrics.btcDominance'), value: globalMetrics.btcDominanceKnown ? `${globalMetrics.btcDominance.toFixed(1)}%` : t('metrics.notInFeed'), icon: Gem },
            {
              label: t('metrics.fearGreed'),
              value: `${Math.round(globalMetrics.fearGreed)}/100`,
              icon: globalMetrics.fearGreed >= 50 ? TrendingUp : TrendingDown,
            },
            { label: t('metrics.assetsListed'), value: globalMetrics.assetsListed.toLocaleString('en-US'), icon: Layers },
          ].map((metric) => (
            <article key={metric.label} className="rounded-xl border border-[#F5B8001A] bg-[#0D1118] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-[#F5B80030]">
              <div className="flex items-center justify-between">
                <p className="text-xs uppercase tracking-[0.12em] text-[#AEB6C4]">{metric.label}</p>
                <metric.icon className="h-4 w-4 text-[#F5B800]" />
              </div>
              <p key={metric.value} className="live-value mt-2 text-xl font-semibold tabular-nums">{metric.value}</p>
            </article>
          ))}
        </section>

        <section className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold sm:text-xl">{t('trendingDashboard.title')}</h2>
              <p className="mt-1 text-xs text-[#AEB6C4]">{t('trendingDashboard.subtitle')}</p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs text-[#9CA3AF]">
              <RefreshCw className="h-3.5 w-3.5 text-[#F5B800]" />
              {t('trendingDashboard.liveSnapshot')}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {trendingCards.map((row) => (
              <Link
                key={row.symbol}
                href={tradeSpotWithSymbol(row.symbol)}
                className="rounded-xl border border-[#F5B80014] bg-[#05070B] p-3 transition hover:border-[#F5B80044]"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CoinIcon symbol={row.asset} size={24} />
                    <div>
                      <p className="text-sm font-semibold">{row.asset}</p>
                      <p className="text-xs text-[#AEB6C4]">{row.symbol.replace('_', '/')}</p>
                    </div>
                  </div>
                  <SparklineMini
                    value={row.change24h}
                    closes={intelligence?.symbols?.[row.symbol.toUpperCase()]?.sparkline ?? []}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <p className="text-[#AEB6C4]">{t('fields.price')}</p>
                  <p className="text-right tabular-nums">{fmtPrice(row.price)}</p>
                  <p className="text-[#AEB6C4]">{t('fields.change24h')}</p>
                  <p className={`inline-flex items-center justify-end gap-1 text-right tabular-nums ${pctClass(row.change24h)}`}>
                    {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {row.change24h >= 0 ? '+' : ''}
                    {row.change24h.toFixed(2)}%
                  </p>
                  <p className="text-[#AEB6C4]">{t('fields.volume')}</p>
                  <p className="text-right tabular-nums">{formatUsdCompact(row.volume24h, t('metrics.noExchangePrints'))}</p>
                  <p className="text-[#AEB6C4]">{t('fields.mktCap')}</p>
                  <p className="text-right tabular-nums">{formatUsdCompact(row.marketCap, '—')}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold sm:text-xl">{t('topMovers.title')}</h2>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: 'trending', label: t('topMovers.tabs.trending') },
                  { id: 'gainers', label: t('topMovers.tabs.gainers') },
                  { id: 'losers', label: t('topMovers.tabs.losers') },
                  { id: 'volume', label: t('topMovers.tabs.volume') },
                  { id: 'new', label: t('topMovers.tabs.new') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMoversTab(tab.id as MoversTab)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] ${
                    moversTab === tab.id
                      ? 'bg-[#F5B800] text-[#05070B]'
                      : 'border border-[#F5B8001A] bg-[#05070B] text-[#AEB6C4] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            {moverRows.map((row) => (
              <Link
                key={`${moversTab}-${row.symbol}`}
                href={tradeSpotWithSymbol(row.symbol)}
                className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-3 transition hover:border-[#F5B80040] hover:bg-[#0B1016]"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{row.asset}</span>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${pctClass(row.change24h)}`}>
                    {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {row.change24h >= 0 ? '+' : ''}
                    {row.change24h.toFixed(2)}%
                  </span>
                </div>
                <p className="text-xs text-[#AEB6C4]">{row.symbol.replace('_', '/')}</p>
                <p className="mt-2 text-xs tabular-nums text-[#AEB6C4]">
                  {formatVolCompact(row.volume24h, t('metrics.noExchangePrints'))}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radar className="h-4 w-4 text-[#F5B800]" />
                <h2 className="text-lg font-semibold sm:text-xl">{t('heatmap.title')}</h2>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#F5B8001A] bg-[#05070B] px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {t('heatmap.buyers')}
                </span>
                <span className="h-3 w-px bg-white/10" />
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                  {t('heatmap.sellers')}
                </span>
              </div>
            </div>
            <div className="relative flex h-[560px] min-h-0 flex-col overflow-hidden rounded-xl border border-white/5 bg-[#05070B] p-2 sm:p-2.5">
              <div className="pointer-events-none absolute inset-0 opacity-[0.24] [background:radial-gradient(circle_at_18%_14%,rgba(245,184,0,0.18),transparent_42%),radial-gradient(circle_at_84%_90%,rgba(56,189,248,0.12),transparent_36%)]" />
              <div className="pointer-events-none absolute inset-0 opacity-25 [background-size:26px_26px] [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)]" />
              <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-5 bg-gradient-to-b from-[#05070B] to-transparent" />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-8 bg-gradient-to-t from-[#05070B] to-transparent" />
              <div className="heat-scroll relative min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                {heatmapRows.map((row, idx) => {
                  const changeAbs = Math.abs(row.change24h);
                  const intensity = Math.min(1, changeAbs / 6);
                  const bullish = row.change24h >= 0;
                  const laneBorder = bullish ? `rgba(16,185,129,${0.34 + intensity * 0.24})` : `rgba(244,63,94,${0.34 + intensity * 0.24})`;
                  const laneBackground = bullish
                    ? `linear-gradient(100deg, rgba(2,6,23,0.82) 0%, rgba(6,78,59,${0.36 + intensity * 0.24}) 72%, rgba(16,185,129,${0.26 + intensity * 0.22}) 100%)`
                    : `linear-gradient(100deg, rgba(2,6,23,0.82) 0%, rgba(127,29,29,${0.36 + intensity * 0.24}) 72%, rgba(244,63,94,${0.26 + intensity * 0.22}) 100%)`;
                  const capShare = Math.max(
                    20,
                    Math.min(100, (row.marketCap / Math.max(1, heatmapRows[0]?.marketCap || 1)) * 100),
                  );
                  const activity = Math.max(12, Math.min(100, 15 + changeAbs * 14));
                  return (
                    <Link
                      key={`heat-ribbon-${row.symbol}`}
                      href={tradeSpotWithSymbol(row.symbol)}
                      className={`group heat-ribbon-anim relative block overflow-hidden rounded-lg border px-2.5 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(0,0,0,0.24)] sm:px-3 ${idx < 3 ? 'py-2.5' : 'py-2'}`}
                      style={{
                        borderColor: laneBorder,
                        background: laneBackground,
                        animationDuration: `${4.2 + (idx % 5) * 0.32}s`,
                        animationDelay: `${idx * 0.08}s`,
                      }}
                    >
                      <div
                        className={`pointer-events-none absolute inset-y-0 left-0 rounded-r-lg ${bullish ? 'bg-emerald-300/20' : 'bg-rose-300/20'}`}
                        style={{ width: `${capShare}%` }}
                      />
                      <div className="pointer-events-none absolute inset-0 opacity-50 [background:linear-gradient(180deg,rgba(255,255,255,0.09)_0%,rgba(255,255,255,0)_48%)]" />
                      <div
                        className="heat-ribbon-scan pointer-events-none absolute inset-y-0 -left-[32%] w-[28%] skew-x-[-16deg] bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-80"
                        style={{ animationDuration: `${5.2 + (idx % 4) * 0.45}s`, animationDelay: `${idx * 0.05}s` }}
                      />
                      <div className="relative grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className="inline-flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-[6px] bg-black/25 text-[9px] font-semibold text-[#d5d9e2]">
                              {idx + 1}
                            </span>
                            <p className="truncate text-[13px] font-semibold tracking-[0.01em]">{row.asset}</p>
                            <p className="truncate text-[10px] text-[#d5d9e2]">{row.symbol.replace('_', '/')}</p>
                            {idx < 3 ? (
                              <span className="rounded bg-black/25 px-1 py-0.5 text-[9px] text-[#d5d9e2]">{t('heatmap.lCapBadge')}</span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center gap-2.5 text-[9px] text-[#d5d9e2] sm:text-[10px]">
                            <span>{formatVolCompact(row.volume24h, t('metrics.noExchangePrints'))}</span>
                            <span>Liq {formatUsdCompact(row.liquidity, '—')}</span>
                            <span className="hidden sm:inline">MCap {formatUsdCompact(row.marketCap, '—')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`inline-flex items-center justify-end gap-1 text-[13px] font-semibold tabular-nums sm:text-sm ${pctClass(row.change24h)}`}>
                            {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                            {row.change24h >= 0 ? '+' : ''}
                            {row.change24h.toFixed(2)}%
                          </p>
                          <p className="mt-0.5 text-[9px] uppercase tracking-[0.08em] text-[#d5d9e2]/80">{t('fields.change24h')}</p>
                        </div>
                      </div>
                      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25">
                        <div
                          className={`h-full rounded-full ${bullish ? 'bg-emerald-300/90' : 'bg-rose-300/90'}`}
                          style={{ width: `${activity}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="relative mt-2.5 flex items-center justify-between text-[11px] text-[#AEB6C4]">
                <span>{t('heatmap.scrollHint')}</span>
                <span>{t('heatmap.laneHint')}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
            <div className="mb-4 flex items-center gap-2">
              <Brain className="h-4 w-4 text-[#F5B800]" />
              <h2 className="text-lg font-semibold sm:text-xl">{t('sectors.title')}</h2>
            </div>
            <div className="sector-scroll h-[560px] space-y-3 overflow-y-auto pr-1">
              <div className="mb-1 flex flex-wrap gap-2">
                {(Object.keys(SECTOR_MAP) as Sector[]).map((name) => {
                  const Icon = SECTOR_ICON[name];
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setSector(name)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs ${
                        sector === name
                          ? 'bg-[#F5B800] text-[#05070B]'
                          : 'border border-[#F5B8001A] text-[#AEB6C4] hover:text-white'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {t(`sectors.names.${name}`)}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-[#F5B80014] bg-[#05070B] p-2.5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#AEB6C4]">{t('sectors.rotationInsight')}</h3>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-lg border border-[#F5B80010] bg-[#0B1016] p-2">
                    <p className="text-[#AEB6C4]">{t('sectors.strongest')}</p>
                    <p className="mt-1 text-sm font-semibold">{strongestSector?.name ?? '--'}</p>
                    <p className={`mt-0.5 inline-flex items-center gap-1 ${pctClass(strongestSector?.avg24h ?? 0)}`}>
                      {(strongestSector?.avg24h ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {(strongestSector?.avg24h ?? 0) >= 0 ? '+' : ''}
                      {(strongestSector?.avg24h ?? 0).toFixed(2)}%
                    </p>
                  </div>
                  <div className="rounded-lg border border-[#F5B80010] bg-[#0B1016] p-2">
                    <p className="text-[#AEB6C4]">{t('sectors.weakest')}</p>
                    <p className="mt-1 text-sm font-semibold">{weakestSector?.name ?? '--'}</p>
                    <p className={`mt-0.5 inline-flex items-center gap-1 ${pctClass(weakestSector?.avg24h ?? 0)}`}>
                      {(weakestSector?.avg24h ?? 0) >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                      {(weakestSector?.avg24h ?? 0) >= 0 ? '+' : ''}
                      {(weakestSector?.avg24h ?? 0).toFixed(2)}%
                    </p>
                  </div>
                </div>
                <div className="mt-2 rounded-lg border border-[#F5B80010] bg-[#0B1016] p-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[#AEB6C4]">{t('sectors.momentumScore')}</span>
                    <span className="font-semibold">{rotationScore.toFixed(0)}/100</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/25">
                    <div className="h-full rounded-full bg-[#F5B800]" style={{ width: `${rotationScore}%` }} />
                  </div>
                  <p className="mt-1.5 text-xs text-[#AEB6C4]">
                    {t('sectors.statusLabel')}: {rotationStatus}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#F5B80014] bg-[#05070B] p-2.5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#AEB6C4]">{t('sectors.leaders')}</h3>
                <div className="space-y-2">
                  {sectorLeaders.slice(0, 4).map((leader) => (
                    <Link
                      key={`leader-${leader.sector}`}
                      href={tradeSpotWithSymbol(leader.symbol)}
                      className="block rounded-lg border border-[#F5B80010] bg-[#0B1016] px-2.5 py-2 transition hover:border-[#F5B80038]"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <p className="font-medium">
                          {leader.sector} · <span className="text-[#AEB6C4]">{leader.asset}</span>
                        </p>
                        <span className={`inline-flex items-center gap-1 font-semibold ${pctClass(leader.change24h)}`}>
                          {leader.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {leader.change24h >= 0 ? '+' : ''}
                          {leader.change24h.toFixed(2)}%
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-[#AEB6C4]">
                        {leader.symbol.replace('_', '/')} · {formatVolCompact(leader.volume24h, t('metrics.noExchangePrints'))}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-[#F5B80014] bg-[#05070B] p-2.5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#AEB6C4]">{t('sectors.dominanceSummary')}</h3>
                <div className="space-y-2">
                  {sectorDominanceRows.map((row) => (
                    <div key={`dominance-${row.name}`} className="rounded-lg border border-[#F5B80010] bg-[#0B1016] p-2">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{row.name}</span>
                        <span className="text-[#AEB6C4]">{row.share.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-black/25">
                        <div className="h-full rounded-full bg-[#F5B800]/80" style={{ width: `${Math.min(100, row.share)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-[#AEB6C4]">
                        {t('sectors.assetsVol', { count: row.count, vol: formatUsdCompact(row.volume, t('metrics.noExchangePrints')) })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
          <h2 className="mb-4 text-lg font-semibold sm:text-xl">{t('filters.title')}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF]">{t('filters.search')}</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#9CA3AF]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('filters.searchPlaceholder')}
                  className="h-9 w-full rounded-lg border border-[#F5B8001F] bg-[#05070B] pl-8 pr-2 text-sm outline-none focus:border-[#F5B80055]"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF]">{t('filters.quote')}</span>
              <select
                value={quoteFilter}
                onChange={(e) => setQuoteFilter(e.target.value)}
                className="h-9 w-full rounded-lg border border-[#F5B8001F] bg-[#05070B] px-2 text-sm outline-none focus:border-[#F5B80055]"
              >
                {quoteOptions.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF]">{t('filters.minPrice')}</span>
              <input
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                placeholder="0"
                className="h-9 w-full rounded-lg border border-[#F5B8001F] bg-[#05070B] px-2 text-sm outline-none focus:border-[#F5B80055]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF]">{t('filters.maxPrice')}</span>
              <input
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="100000"
                className="h-9 w-full rounded-lg border border-[#F5B8001F] bg-[#05070B] px-2 text-sm outline-none focus:border-[#F5B80055]"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF]">{t('filters.direction24h')}</span>
              <select
                value={changeSide}
                onChange={(e) => setChangeSide(e.target.value as 'all' | 'positive' | 'negative')}
                className="h-9 w-full rounded-lg border border-[#F5B8001F] bg-[#05070B] px-2 text-sm outline-none focus:border-[#F5B80055]"
              >
                <option value="all">{t('filters.all')}</option>
                <option value="positive">{t('filters.positive')}</option>
                <option value="negative">{t('filters.negative')}</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold sm:text-xl">{t('table.title')}</h2>
            <p className="text-xs text-[#AEB6C4]">
              {t('fields.assetsCount', { count: tableRows.length.toLocaleString('en-US') })} · {t('fields.virtualized')}
            </p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[1120px] rounded-lg border border-[#F5B8001A] bg-[#05070B]">
              <div className="sticky top-0 z-20 grid grid-cols-[60px_170px_130px_100px_100px_140px_150px_90px_110px] items-center border-b border-[#F5B8001A] bg-[#0A0F16]/95 px-3 py-2 backdrop-blur">
                <SortButton label={t('table.rank')} active={sortKey === 'rank'} dir={sortDir} onClick={() => onSort('rank')} />
                <SortButton label={t('table.asset')} active={sortKey === 'asset'} dir={sortDir} onClick={() => onSort('asset')} />
                <SortButton label={t('fields.price')} active={sortKey === 'price'} dir={sortDir} onClick={() => onSort('price')} />
                <SortButton label={t('fields.change24h')} active={sortKey === 'change24h'} dir={sortDir} onClick={() => onSort('change24h')} />
                <SortButton label={t('fields.change7d')} active={sortKey === 'change7d'} dir={sortDir} onClick={() => onSort('change7d')} />
                <SortButton label={t('fields.volume')} active={sortKey === 'volume24h'} dir={sortDir} onClick={() => onSort('volume24h')} />
                <SortButton label={t('fields.mktCap')} active={sortKey === 'marketCap'} dir={sortDir} onClick={() => onSort('marketCap')} />
                <SortButton label={t('table.liquidityShort')} active={sortKey === 'liquidity'} dir={sortDir} onClick={() => onSort('liquidity')} />
                <span className="text-right text-[11px] font-medium uppercase tracking-[0.1em] text-[#9CA3AF]">{t('table.action')}</span>
              </div>
              {tableRows.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    title={t('empty.noFilterMatchTitle')}
                    description={t('empty.noFilterMatchDesc')}
                    icon={BarChart3}
                  />
                </div>
              ) : (
                <div
                  ref={tableRef}
                  className="market-table-scroll overflow-y-auto"
                  style={{ height: TABLE_VIEWPORT_HEIGHT }}
                  onScroll={(e) => setScrollTop((e.currentTarget as HTMLDivElement).scrollTop)}
                >
                  <div style={{ height: topSpacer }} />
                  {visibleRows.map((row) => (
                    <div
                      key={`table-${row.symbol}`}
                      className="grid grid-cols-[60px_170px_130px_100px_100px_140px_150px_90px_110px] items-center border-b border-[#F5B80010] px-3 transition-colors hover:bg-[#0B1119]"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <span className="text-sm tabular-nums text-[#AEB6C4]">{row.rank}</span>
                      <div className="flex items-center gap-2">
                        <CoinIcon symbol={row.asset} size={22} />
                        <div>
                          <p className="text-sm font-medium">{row.asset}</p>
                          <p className="text-xs text-[#AEB6C4]">{row.symbol.replace('_', '/')}</p>
                        </div>
                      </div>
                      <span key={`${row.symbol}-p-${row.price}`} className="live-value text-sm tabular-nums">{fmtPrice(row.price)}</span>
                      <span className={`inline-flex items-center gap-1 text-sm tabular-nums ${pctClass(row.change24h)}`}>
                        {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {row.change24h >= 0 ? '+' : ''}
                        {row.change24h.toFixed(2)}%
                      </span>
                      <span className={`inline-flex items-center gap-1 text-sm tabular-nums ${pctClass(row.change7d)}`}>
                        {row.change7d >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {row.change7d >= 0 ? '+' : ''}
                        {row.change7d.toFixed(2)}%
                      </span>
                      <span className="text-sm tabular-nums text-[#AEB6C4]">{formatUsdCompact(row.volume24h, t('metrics.noExchangePrints'))}</span>
                      <span className="text-sm tabular-nums text-[#AEB6C4]">{formatUsdCompact(row.marketCap, '—')}</span>
                      <span className="text-sm tabular-nums text-[#AEB6C4]">{row.liquidity.toFixed(1)}</span>
                      <div className="text-right">
                        <Link
                          href={tradeSpotWithSymbol(row.symbol)}
                          className="inline-flex items-center rounded-md bg-[#F5B800] px-3 py-1.5 text-xs font-semibold text-[#05070B] shadow-[0_2px_8px_rgba(245,184,0,0.2)] hover:bg-[#FFD54A]"
                        >
                          {t('table.trade')}
                        </Link>
                      </div>
                    </div>
                  ))}
                  <div style={{ height: bottomSpacer }} />
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
            <h2 className="mb-3 text-lg font-semibold sm:text-xl">{t('recentlyAdded.title')}</h2>
            <div className="space-y-2">
              {newListings.map((row) => (
                <Link
                  key={`new-${row.symbol}`}
                  href={tradeSpotWithSymbol(row.symbol)}
                  className="flex items-center justify-between rounded-lg border border-[#F5B80012] bg-[#05070B] px-3 py-2.5 transition hover:border-[#F5B80040] hover:bg-[#0B1016]"
                >
                  <div className="flex items-center gap-2">
                    <CoinIcon symbol={row.asset} size={20} />
                    <div>
                      <p className="text-sm font-medium">{row.asset}</p>
                      <p className="text-[11px] text-[#9CA3AF]">{row.symbol.replace('_', '/')}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${pctClass(row.change24h)}`}>
                    {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                    {row.change24h >= 0 ? '+' : ''}
                    {row.change24h.toFixed(2)}%
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold sm:text-xl">{t('intelligence.title')}</h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-[#F5B8001A] bg-[#05070B] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[#AEB6C4]">
                <Activity className="h-3 w-3 text-[#F5B800]" />
                {t('intelligence.liveUpdate')}
              </span>
            </div>

            <div className="mb-3 flex flex-wrap gap-2">
              {(
                [
                  { id: 'latest', label: t('intelligence.panels.latest') },
                  { id: 'announcements', label: t('intelligence.panels.announcements') },
                  { id: 'listings', label: t('intelligence.panels.listings') },
                  { id: 'pulse', label: t('intelligence.panels.pulse') },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNewsPanel(tab.id as NewsPanel)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                    newsPanel === tab.id
                      ? 'bg-[#F5B800] text-[#05070B]'
                      : 'border border-[#F5B8001A] bg-[#05070B] text-[#AEB6C4] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="min-h-[250px] space-y-2">
              {newsPanel === 'latest' &&
                (announcementCards.length ? announcementCards : [{ title: t('empty.noAnnouncements'), badge: '—', ago: '—' }]).map((item) => (
                  <article key={item.title} className="rounded-lg border border-[#F5B80012] bg-[#05070B] px-3 py-2.5 transition hover:border-[#F5B80036] hover:bg-[#0B1016]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#F5B800]">{item.badge}</p>
                      <p className="text-[11px] text-[#AEB6C4]">ADB Exchange · {item.ago}</p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#d8dde7]">{item.title}</p>
                  </article>
                ))}

              {newsPanel === 'announcements' &&
                exchangeAnnouncements.map((item) => (
                  <article key={item.title} className="rounded-lg border border-[#F5B80012] bg-[#05070B] px-3 py-2.5 transition hover:border-[#F5B80036] hover:bg-[#0B1016]">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#F5B800]">{item.priority}</p>
                      <p className="text-[11px] text-[#AEB6C4]">{item.ago}</p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-[#d8dde7]">{item.title}</p>
                  </article>
                ))}

              {newsPanel === 'listings' &&
                newListings.map((row) => (
                  <Link
                    key={`intel-listing-${row.symbol}`}
                    href={tradeSpotWithSymbol(row.symbol)}
                    className="block rounded-lg border border-[#F5B80012] bg-[#05070B] px-3 py-2.5 transition hover:border-[#F5B80036] hover:bg-[#0B1016]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold">{row.symbol.replace('_', '/')}</p>
                      <p className={`inline-flex items-center gap-1 text-xs font-semibold ${pctClass(row.change24h)}`}>
                        {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                        {row.change24h >= 0 ? '+' : ''}
                        {row.change24h.toFixed(2)}%
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[#AEB6C4]">
                      {row.asset} · {formatVolCompact(row.volume24h, t('metrics.noExchangePrints'))}
                    </p>
                  </Link>
                ))}

              {newsPanel === 'pulse' && (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">{t('intelligence.bullishAssets')}</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-400">{bullishPct.toFixed(1)}%</p>
                    </div>
                    <div className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">{t('intelligence.bearishAssets')}</p>
                      <p className="mt-1 text-lg font-semibold text-rose-400">{bearishPct.toFixed(1)}%</p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-2.5">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">{t('intelligence.fearGreedScore')}</p>
                    <p className="mt-1 text-lg font-semibold">{Math.round(globalMetrics.fearGreed)}/100</p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-black/30">
                      <div className="h-full rounded-full bg-[#F5B800]" style={{ width: `${Math.round(globalMetrics.fearGreed)}%` }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">{t('intelligence.strongestSector')}</p>
                      <p className="mt-1 text-sm font-semibold">{strongestSector?.name ?? '--'}</p>
                    </div>
                    <div className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-2.5">
                      <p className="text-[11px] uppercase tracking-[0.1em] text-[#AEB6C4]">{t('intelligence.weakestSector')}</p>
                      <p className="mt-1 text-sm font-semibold">{weakestSector?.name ?? '--'}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="mt-3 rounded-lg border border-[#F5B80010] bg-[#05070B] px-2.5 py-2 text-[11px] text-[#AEB6C4]">
              <span className="font-semibold text-[#F5B800]">{t('intelligence.dataSources')}</span>{' '}
              {t('intelligence.dataSourcesDetail', { hint: MARKET_INTEL_CACHE_HINT })}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[#F5B8001A] bg-[#0D1118] p-4 sm:p-5">
          <h2 className="mb-3 text-lg font-semibold sm:text-xl">{t('activePairs.title')}</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {activePairs.map((row) => (
              <Link
                key={`active-${row.symbol}`}
                href={tradeSpotWithSymbol(row.symbol)}
                className="rounded-lg border border-[#F5B80012] bg-[#05070B] p-3 transition hover:border-[#F5B80040] hover:bg-[#0B1016]"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-semibold">{row.symbol.replace('_', '/')}</span>
                  <Activity className="h-3.5 w-3.5 text-[#F5B800]" />
                </div>
                <p className="text-xs text-[#9CA3AF]">{formatVolCompact(row.volume24h, t('metrics.noExchangePrints'))}</p>
                <p className={`mt-1 inline-flex items-center gap-0.5 text-xs font-semibold ${pctClass(row.change24h)}`}>
                  {row.change24h >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {row.change24h >= 0 ? '+' : ''}
                  {row.change24h.toFixed(2)}%
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <style jsx global>{`
        @keyframes heatRibbonPulse {
          0%, 100% {
            transform: translateY(0) scale(1);
            filter: saturate(1) brightness(1);
          }
          50% {
            transform: translateY(-0.6px) scale(1.004);
            filter: saturate(1.1) brightness(1.03);
          }
        }
        @keyframes heatRibbonSweep {
          0% {
            transform: translateX(-180%);
            opacity: 0;
          }
          10% {
            opacity: 0.4;
          }
          45% {
            opacity: 0.26;
          }
          100% {
            transform: translateX(470%);
            opacity: 0;
          }
        }
        .heat-ribbon-anim {
          animation-name: heatRibbonPulse;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
        }
        .heat-ribbon-scan {
          animation-name: heatRibbonSweep;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .heat-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(245, 184, 0, 0.45) rgba(255, 255, 255, 0.06);
        }
        .heat-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .heat-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 9999px;
        }
        .heat-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(245, 184, 0, 0.82), rgba(245, 184, 0, 0.45));
          border-radius: 9999px;
        }
        .sector-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(245, 184, 0, 0.4) rgba(255, 255, 255, 0.06);
        }
        .sector-scroll::-webkit-scrollbar {
          width: 6px;
        }
        .sector-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.06);
          border-radius: 9999px;
        }
        .sector-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(245, 184, 0, 0.78), rgba(245, 184, 0, 0.4));
          border-radius: 9999px;
        }
        .quick-movers-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(245, 184, 0, 0.38) rgba(255, 255, 255, 0.04);
        }
        .quick-movers-scroll::-webkit-scrollbar {
          height: 5px;
        }
        .quick-movers-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 9999px;
        }
        .quick-movers-scroll::-webkit-scrollbar-thumb {
          background: rgba(245, 184, 0, 0.55);
          border-radius: 9999px;
        }
        .market-table-scroll {
          scrollbar-width: thin;
          scrollbar-color: rgba(245, 184, 0, 0.36) rgba(255, 255, 255, 0.05);
        }
        .market-table-scroll::-webkit-scrollbar {
          width: 8px;
        }
        .market-table-scroll::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
        }
        .market-table-scroll::-webkit-scrollbar-thumb {
          background: linear-gradient(180deg, rgba(245, 184, 0, 0.65), rgba(245, 184, 0, 0.35));
          border-radius: 9999px;
        }
        @keyframes liveValueFlash {
          0% { opacity: 0.72; transform: translateY(1px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .live-value {
          animation: liveValueFlash 220ms ease-out;
        }
        @media (prefers-reduced-motion: reduce) {
          .heat-ribbon-anim,
          .heat-ribbon-scan,
          .live-value {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}
