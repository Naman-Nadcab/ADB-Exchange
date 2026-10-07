'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useMutation } from '@tanstack/react-query';
import RequireAuth from '@/components/RequireAuth';
import { useP2pReferencePrice } from '@/hooks/useP2pReferencePrice';
import { createAd, fetchPlatformPaymentMethods, fetchMyPaymentMethods } from '@/lib/p2pApi';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp, Lightbulb, Shield, Zap, Target, Eye,
  BarChart3, ArrowUpDown, Clock, CheckCircle2, Sparkles, CreditCard, ShoppingBag,
} from 'lucide-react';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { formatFiatSymbol, formatP2pFiatPrice } from '@/lib/p2p-v2-utils';

export default function P2PV2CreateAdPage() {
  return (
    <RequireAuth>
      <CreateAdForm />
    </RequireAuth>
  );
}

function CreateAdForm() {
  const t = useTranslations('p2p.createAd');
  const tn = useTranslations('p2p.nav');
  const tl = useTranslations('p2p.common');
  const router = useRouter();
  const [side, setSide] = useState<'buy' | 'sell'>('sell');
  const [crypto, setCrypto] = useState('USDT');
  const [fiat, setFiat] = useState('USD');
  const [pricing, setPricing] = useState<'fixed' | 'floating'>('fixed');
  const [fixedPrice, setFixedPrice] = useState('');
  const [marginPct, setMarginPct] = useState('0');
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [totalAmt, setTotalAmt] = useState('');
  const [timeLimit, setTimeLimit] = useState(15);
  const [autoRel, setAutoRel] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [autoReply, setAutoReply] = useState('');
  const [selectedPm, setSelectedPm] = useState<string[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const { price: marketPrice } = useP2pReferencePrice(crypto, fiat, 4000);

  const computedFloating = useMemo(() => {
    const m = parseFloat(marginPct);
    if (!Number.isFinite(m) || marketPrice == null || marketPrice <= 0) return null;
    return marketPrice * (1 + m / 100);
  }, [marginPct, marketPrice]);

  const { data: platformPm = [] } = useQuery({
    queryKey: ['p2p-v2', 'platform-pm'],
    queryFn: fetchPlatformPaymentMethods,
  });

  const { data: myPm = [] } = useQuery({
    queryKey: ['p2p-v2', 'my-pm'],
    queryFn: () => fetchMyPaymentMethods(),
  });

  const mut = useMutation({
    mutationFn: () => {
      const priceStr =
        pricing === 'floating'
          ? (computedFloating != null ? String(computedFloating.toFixed(4)) : '')
          : fixedPrice.trim();
      if (!priceStr) throw new Error(t('errInvalidPrice'));
      return createAd({
        type: side,
        currency: crypto,
        fiat,
        price: priceStr,
        min_amount: minAmt.trim(),
        max_amount: maxAmt.trim(),
        available_amount: totalAmt.trim(),
        payment_method_ids: selectedPm,
        payment_time_limit: timeLimit,
        auto_release: autoRel,
        remarks: remarks.trim() || undefined,
        auto_reply: autoReply.trim() || undefined,
        pricing_type: pricing === 'floating' ? 'floating' : 'fixed',
        float_margin_percent: pricing === 'floating' ? parseFloat(marginPct) : undefined,
      });
    },
    onSuccess: (res) => {
      if (res.success) {
        router.push('/p2p/my-ads');
      } else {
        setErr(res.error?.message ?? t('submitFailed'));
      }
    },
    onError: (e: Error) => setErr(e.message),
  });

  const diffPct =
    pricing === 'floating' && marketPrice && computedFloating
      ? (((computedFloating - marketPrice) / marketPrice) * 100).toFixed(2)
      : null;

  const sym = formatFiatSymbol(fiat);
  const sideWord = side === 'sell' ? t('sideWordSell') : t('sideWordBuy');
  const pairLabel = `${crypto}/${fiat}`;
  const proTipKeys = ['tip1', 'tip2', 'tip3', 'tip4', 'tip5'] as const;

  /* ── derived display price for preview ── */
  const displayPrice = useMemo(() => {
    if (pricing === 'floating') return computedFloating;
    const n = parseFloat(fixedPrice);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [pricing, fixedPrice, computedFloating]);

  /* ── smart price suggestions (UI only) ── */
  const priceSuggestions = useMemo(() => {
    if (marketPrice == null || marketPrice <= 0) return null;
    const bestPrice = side === 'sell' ? marketPrice * 1.001 : marketPrice * 0.999;
    const fastFill = side === 'sell' ? marketPrice * 0.998 : marketPrice * 1.002;
    const competitive = marketPrice;
    return { bestPrice, fastFill, competitive };
  }, [marketPrice, side]);

  /* ── performance indicators (UI only) ── */
  const perfIndicators = useMemo(() => {
    if (displayPrice == null || marketPrice == null || marketPrice <= 0) return null;
    const priceDiffPct = ((displayPrice - marketPrice) / marketPrice) * 100;
    const pmCount = selectedPm.length;
    const hasLimits = minAmt.trim() !== '' && maxAmt.trim() !== '';
    const speed = Math.min(100, Math.max(10, 100 - Math.abs(priceDiffPct) * 10 + pmCount * 15 + (autoRel ? 15 : 0)));
    const visibility = Math.min(100, Math.max(10, 40 + pmCount * 20 + (hasLimits ? 20 : 0) + (remarks.trim() ? 10 : 0)));
    const profit = side === 'sell'
      ? Math.min(100, Math.max(10, 50 + priceDiffPct * 8))
      : Math.min(100, Math.max(10, 50 - priceDiffPct * 8));
    return { speed: Math.round(speed), visibility: Math.round(visibility), profit: Math.round(profit) };
  }, [displayPrice, marketPrice, selectedPm.length, minAmt, maxAmt, autoRel, remarks, side]);

  const inputCls = 'w-full rounded-xl border border-border/40 bg-background px-4 py-3 text-sm text-foreground transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/10 focus:outline-none placeholder:text-muted-foreground/40';
  const labelCls = 'mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-10 sm:px-6">
      <header className="flex flex-col gap-3 border-b border-border/20 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{t('title')}</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {t('subtitle', { side: sideWord, pair: pairLabel })}
          </p>
        </div>
        <Link
          href="/p2p"
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-border/40 px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
        >
          {tn('marketplace')}
        </Link>
      </header>

      <div className="mt-6 grid gap-7 lg:grid-cols-[1fr_340px]">
        {/* ══════════ LEFT: MAIN FORM ══════════ */}
        <div className="space-y-6">

          {/* ─── Section 1: Asset & Side ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm shadow-primary/10">1</span>
              {t('sectionAssetType')}
            </h2>
            <div className="flex gap-2">
              {(['sell', 'buy'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSide(s)}
                  className={`flex-1 rounded-xl px-5 py-3 text-sm font-bold transition-all duration-200 sm:flex-none sm:min-w-[120px] ${
                    side === s
                      ? s === 'sell'
                        ? 'bg-[#f6465d]/10 text-[#f6465d] ring-1 ring-[#f6465d]/20 shadow-sm'
                        : 'bg-[#0ecb81]/10 text-[#0ecb81] ring-1 ring-[#0ecb81]/20 shadow-sm'
                      : 'bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted/50'
                  }`}
                >
                  {s === 'sell' ? t('wantToSell') : t('wantToBuy')}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>{t('cryptoAsset')}</label>
                <select value={crypto} onChange={(e) => setCrypto(e.target.value)} className={inputCls}>
                  {['USDT', 'BTC', 'ETH', 'USDC'].map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>{t('fiatCurrency')}</label>
                <select value={fiat} onChange={(e) => setFiat(e.target.value)} className={inputCls}>
                  {['USD', 'INR', 'EUR', 'GBP'].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ─── Section 2: Pricing ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm shadow-primary/10">2</span>
              {t('sectionPricing')}
            </h2>
            <div className="flex gap-2">
              {(['fixed', 'floating'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPricing(p)}
                  className={`rounded-full px-5 py-2 text-sm font-bold transition-all duration-200 ${
                    pricing === p
                      ? 'bg-primary/15 text-primary ring-1 ring-primary/25 shadow-[0_0_12px_hsl(var(--primary)/0.1)]'
                      : 'border border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                  }`}
                >
                  {p === 'fixed' ? t('pricingFixed') : t('pricingFloating')}
                </button>
              ))}
            </div>

            {/* Smart Price Suggestions */}
            {pricing === 'fixed' && priceSuggestions && (
              <div className="rounded-xl border border-primary/10 bg-primary/[0.03] p-4">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  {t('smartSuggestionsTitle')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'best' as const, labelKey: 'suggestBestPrice' as const, descKey: 'suggestBestDesc' as const, val: priceSuggestions.bestPrice },
                    { id: 'market' as const, labelKey: 'suggestMarket' as const, descKey: 'suggestMarketDesc' as const, val: priceSuggestions.competitive },
                    { id: 'fast' as const, labelKey: 'suggestFastFill' as const, descKey: 'suggestFastDesc' as const, val: priceSuggestions.fastFill },
                  ].map(({ id, labelKey, descKey, val }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setFixedPrice(val.toFixed(4))}
                      className="group rounded-lg border border-border/30 bg-background/60 px-3 py-2.5 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm"
                    >
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground group-hover:text-primary transition-colors">{t(labelKey)}</p>
                      <p className="numeric font-mono text-sm font-semibold tabular-nums text-foreground mt-0.5">{sym}{formatP2pFiatPrice(String(val), fiat)}</p>
                      <p className="text-xs text-muted-foreground/60">{t(descKey)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {pricing === 'floating' && (
              <div className="rounded-xl border border-border/30 bg-muted/20 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">{t('referencePrice')}</p>
                  <span className="numeric font-mono text-sm font-semibold tabular-nums text-foreground">{marketPrice != null ? `${sym}${formatP2pFiatPrice(String(marketPrice), fiat)}` : '—'}</span>
                </div>
                <div>
                  <label className={labelCls}>{t('marginPct')}</label>
                  <input type="number" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} className={`${inputCls} font-mono`} placeholder={t('marginPlaceholder')} />
                </div>
                {computedFloating != null && (
                  <div className="flex items-center justify-between rounded-lg bg-background/60 px-4 py-3">
                    <span className="text-xs text-muted-foreground">{t('yourAdPrice')}</span>
                    <div className="text-right">
                      <span className="numeric font-mono text-base font-semibold tabular-nums text-foreground">{sym}{formatP2pFiatPrice(String(computedFloating), fiat)}</span>
                      {diffPct != null && (
                        <span className={`ml-2 rounded-md px-1.5 py-0.5 text-xs font-bold ${
                          parseFloat(diffPct) >= 0 ? 'bg-[#0ecb81]/10 text-[#0ecb81]' : 'bg-[#f6465d]/10 text-[#f6465d]'
                        }`}>
                          {parseFloat(diffPct) >= 0 ? '+' : ''}{diffPct}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {pricing === 'fixed' && (
              <div>
                <label className={labelCls}>{t('pricePerUnit', { fiat, crypto })}</label>
                <input value={fixedPrice} onChange={(e) => setFixedPrice(e.target.value)} placeholder={marketPrice != null ? t('priceExamplePlaceholder', { example: formatP2pFiatPrice(String(marketPrice), fiat) }) : t('priceFallbackPlaceholder')} className={`${inputCls} font-mono text-base`} />
                {displayPrice != null && marketPrice != null && marketPrice > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {((displayPrice - marketPrice) / marketPrice * 100) >= 0 ? t('premium') : t('discount')}:{' '}
                    <span className={`font-bold ${((displayPrice - marketPrice) / marketPrice * 100) >= 0 ? 'text-[#0ecb81]' : 'text-[#f6465d]'}`}>
                      {((displayPrice - marketPrice) / marketPrice * 100).toFixed(2)}%
                    </span>
                    {' '}{t('vsMarket')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ─── Section 3: Limits ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm shadow-primary/10">3</span>
              {t('sectionLimits')}
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>{t('minCrypto', { crypto })}</label>
                <input value={minAmt} onChange={(e) => setMinAmt(e.target.value)} placeholder={t('minPlaceholder')} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>{t('maxCrypto', { crypto })}</label>
                <input value={maxAmt} onChange={(e) => setMaxAmt(e.target.value)} placeholder={t('maxPlaceholder')} className={`${inputCls} font-mono`} />
              </div>
              <div>
                <label className={labelCls}>{t('totalCrypto', { crypto })}</label>
                <input value={totalAmt} onChange={(e) => setTotalAmt(e.target.value)} placeholder={t('totalPlaceholder')} className={`${inputCls} font-mono`} />
              </div>
            </div>
          </div>

          {/* ─── Section 4: Payment ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm shadow-primary/10">4</span>
              {t('sectionPayment')}
            </h2>
            <div>
              <label className={labelCls}>{t('paymentWindow')}</label>
              <input type="number" min={5} max={120} value={timeLimit} onChange={(e) => setTimeLimit(Number(e.target.value))} className={inputCls} />
              <p className="mt-1.5 text-xs text-muted-foreground">{t('paymentWindowHint')}</p>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5" />
                {t('acceptedMethods')}
                {selectedPm.length > 0 && (
                  <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary">{selectedPm.length}</span>
                )}
              </p>
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-xl border border-border/30 bg-muted/10 p-3">
                {myPm.length === 0 && (
                  <p className="text-xs text-muted-foreground py-4 text-center">{t('noSavedMethods')}</p>
                )}
                {myPm.map((m) => {
                  const checked = selectedPm.includes(m.id);
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm cursor-pointer transition-all duration-150 ${
                        checked ? 'bg-primary/[0.06] ring-1 ring-primary/15' : 'hover:bg-muted/30'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedPm([...selectedPm, m.id]);
                          else setSelectedPm(selectedPm.filter((x) => x !== m.id));
                        }}
                        className="rounded border-border accent-primary"
                      />
                      <span className={`font-medium ${checked ? 'text-foreground' : 'text-muted-foreground'}`}>{m.display_name || m.method_name}</span>
                    </label>
                  );
                })}
              </div>
              {platformPm.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">{t('platformTypes', { types: platformPm.map((p) => p.code).filter(Boolean).join(', ') })}</p>
              )}
            </div>
          </div>

          {/* ─── Section 5: Conditions ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
            <h2 className="flex items-center gap-2.5 text-sm font-bold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary shadow-sm shadow-primary/10">5</span>
              {t('sectionConditions')}
            </h2>
            <label className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/10 px-4 py-3.5 text-sm cursor-pointer transition-all duration-200 hover:bg-muted/20">
              <input type="checkbox" checked={autoRel} onChange={(e) => setAutoRel(e.target.checked)} className="rounded border-border accent-primary" />
              <div>
                <span className="font-medium text-foreground">{t('autoReleaseTitle')}</span>
                <p className="text-xs text-muted-foreground mt-0.5">{t('autoReleaseHint')}</p>
              </div>
            </label>
            <div>
              <label className={labelCls}>{t('termsLabel')}</label>
              <textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} placeholder={t('termsPlaceholder')} className={`${inputCls} resize-none`} />
            </div>
            <div>
              <label className={labelCls}>{t('autoReplyLabel')}</label>
              <textarea value={autoReply} onChange={(e) => setAutoReply(e.target.value)} rows={2} placeholder={t('autoReplyPlaceholder')} className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="rounded-xl border border-[#f6465d]/20 bg-[#f6465d]/5 px-4 py-3 text-sm font-medium text-[#f6465d]">
              {err}
            </div>
          )}

          {/* Submit */}
          <button
            type="button"
            disabled={mut.isPending || selectedPm.length === 0}
            onClick={() => { setErr(null); mut.mutate(); }}
            className="w-full rounded-xl bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:bg-primary/90 hover:shadow-lg hover:shadow-primary/30 disabled:opacity-50 active:scale-[0.99]"
          >
            {mut.isPending ? t('publishing') : t('publishAd')}
          </button>
        </div>

        {/* ══════════ RIGHT: SIDEBAR ══════════ */}
        <div className="hidden lg:block space-y-5 self-start sticky top-20">

          {/* ─── Market Insights Panel ─── */}
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-b from-card via-card to-muted/10 p-5 shadow-sm">
            <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-primary/[0.04] blur-[40px]" />
            <div className="relative space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shadow-sm shadow-primary/10">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                {t('marketInsights')}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">{t('marketPrice')}</p>
                  <p className="numeric font-mono text-lg font-semibold tabular-nums text-foreground mt-1">
                    {marketPrice != null ? `${sym}${formatP2pFiatPrice(String(marketPrice), fiat)}` : '—'}
                  </p>
                </div>
                <div className="rounded-xl bg-muted/20 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">{t('yourPrice')}</p>
                  <p className="numeric font-mono text-lg font-semibold tabular-nums text-foreground mt-1">
                    {displayPrice != null ? `${sym}${formatP2pFiatPrice(String(displayPrice), fiat)}` : '—'}
                  </p>
                </div>
              </div>
              {displayPrice != null && marketPrice != null && marketPrice > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-background/60 px-3 py-2.5">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowUpDown className="h-3 w-3" />
                    {t('spread')}
                  </span>
                  <span className={`numeric rounded-md px-2 py-0.5 font-mono text-sm font-semibold tabular-nums ${
                    ((displayPrice - marketPrice) / marketPrice) >= 0
                      ? 'bg-[#0ecb81]/10 text-[#0ecb81]'
                      : 'bg-[#f6465d]/10 text-[#f6465d]'
                  }`}>
                    {((displayPrice - marketPrice) / marketPrice * 100) >= 0 ? '+' : ''}
                    {((displayPrice - marketPrice) / marketPrice * 100).toFixed(2)}%
                  </span>
                </div>
              )}
              <p className="text-xs text-muted-foreground">{t('pairUpdatedEvery4s', { pair: pairLabel })}</p>
            </div>
          </div>

          {/* ─── Live Ad Preview ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                <Eye className="h-4 w-4 text-blue-500" />
              </div>
              {t('livePreview')}
            </div>
            <div className="rounded-xl border border-border/30 bg-muted/10 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CoinIcon symbol={crypto} size={24} />
                  <div>
                    <p className="text-sm font-bold text-foreground">{pairLabel}</p>
                    <p className="text-xs text-muted-foreground">{t('previewSideAd', { side: sideWord })}</p>
                  </div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                  side === 'sell' ? 'bg-[#f6465d]/10 text-[#f6465d]' : 'bg-[#0ecb81]/10 text-[#0ecb81]'
                }`}>{sideWord}</span>
              </div>
              <div className="h-px bg-border/30" />
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('price')}</span>
                <span className="numeric font-mono font-semibold tabular-nums text-foreground">{displayPrice != null ? `${sym}${formatP2pFiatPrice(String(displayPrice), fiat)}` : '—'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{tl('limits')}</span>
                <span className="font-mono text-foreground">{minAmt || '—'} – {maxAmt || '—'} {fiat}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('available')}</span>
                <span className="font-mono text-foreground">{totalAmt || '—'} {crypto}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('methods')}</span>
                <span className="text-foreground">{t('methodsSelected', { count: selectedPm.length || 0 })}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{t('window')}</span>
                <span className="text-foreground">{t('minutesShort', { count: timeLimit })}</span>
              </div>
            </div>
          </div>

          {/* ─── Performance Indicator ─── */}
          {perfIndicators && (
            <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0ecb81]/10">
                  <Target className="h-4 w-4 text-[#0ecb81]" />
                </div>
                {t('adScore')}
              </div>
              {[
                { labelKey: 'scoreSpeed' as const, value: perfIndicators.speed, icon: Zap, color: '#0ecb81' },
                { labelKey: 'scoreVisibility' as const, value: perfIndicators.visibility, icon: Eye, color: 'hsl(var(--primary))' },
                { labelKey: 'scoreProfit' as const, value: perfIndicators.profit, icon: TrendingUp, color: '#3b82f6' },
              ].map(({ labelKey, value, icon: Icon, color }) => (
                <div key={labelKey} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Icon className="h-3 w-3" style={{ color }} />
                      {t(labelKey)}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-foreground">{value}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/30">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${value}%`, backgroundColor: color, boxShadow: `0 0 6px ${color}40` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ─── Tips ─── */}
          <div className="rounded-2xl border border-border/40 bg-card p-5 shadow-sm space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-foreground">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <Lightbulb className="h-4 w-4 text-amber-500" />
              </div>
              {t('proTipsTitle')}
            </div>
            <ul className="space-y-2.5 text-xs text-muted-foreground leading-relaxed">
              {proTipKeys.map((key) => (
                <li key={key} className="flex gap-2">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                  {t(key)}
                </li>
              ))}
            </ul>
          </div>

          {/* ─── Trust Badges ─── */}
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5 rounded-xl border border-[#0ecb81]/15 bg-[#0ecb81]/[0.04] px-4 py-3">
              <Shield className="h-4 w-4 text-[#0ecb81]" />
              <div>
                <p className="text-xs font-bold text-foreground">{t('escrowProtectedTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('escrowProtectedDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-blue-500/15 bg-blue-500/[0.04] px-4 py-3">
              <CheckCircle2 className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-xs font-bold text-foreground">{t('secureTradeTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('secureTradeDesc')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] px-4 py-3">
              <Clock className="h-4 w-4 text-primary" />
              <div>
                <p className="text-xs font-bold text-foreground">{t('supportTitle')}</p>
                <p className="text-xs text-muted-foreground">{t('supportDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
