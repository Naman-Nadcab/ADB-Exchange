'use client';

import { useTranslations } from 'next-intl';

import { useMemo, useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import Link from 'next/link';
import { notifyError } from '@/lib/notifyError';
import {
  HelpCircle,
  ChevronRight,
  TrendingUp,
  Award,
  Loader2,
  ExternalLink,
  Info,
} from 'lucide-react';

type TabType = 'trading' | 'interest';

interface FeeRate {
  maker: number;
  taker: number;
  fiatMaker?: number;
  fiatTaker?: number;
}

interface VipRequirement {
  id: string;
  title: string;
  helpText?: string;
  current: number;
  required: number;
  unit: string;
  link: string;
  linkText: string;
}

interface UserFeeData {
  vipLevel: number;
  vipLevelName: string;
  spotFees: FeeRate;
  mntDiscount: boolean;
  tradingVolume30d: number;
  totalEquity: number;
  avgEquity30d: number;
}

interface VolumeFeeTier {
  tierLevel: number;
  maker: string;
  taker: string;
  volume30d: string;
  nextTierMinVolume: string | null;
  tierName?: string;
}

export default function FeeRatesPage() {
  const tf = useTranslations('account.feeRates');
  const tt = useTranslations('account.toasts');
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('trading');
  const [loading, setLoading] = useState(true);
  const [mntDiscountEnabled, setMntDiscountEnabled] = useState(false);
  const [feeData, setFeeData] = useState<UserFeeData>({
    vipLevel: 0,
    vipLevelName: 'Regular User',
    spotFees: { maker: 0.1, taker: 0.1, fiatMaker: 0.15, fiatTaker: 0.2 },
    mntDiscount: false,
    tradingVolume30d: 0,
    totalEquity: 0,
    avgEquity30d: 0,
  });
  const [volumeTier, setVolumeTier] = useState<VolumeFeeTier | null>(null);

  const apiUrl = getApiBaseUrl();

  // Fetch fee rates from backend
  useEffect(() => {
    const fetchFeeRates = async () => {
      if (!accessToken) return;
      
      setLoading(true);
      try {
        const response = await fetch(`${apiUrl}/api/v1/auth/fee-rates`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await response.json();
        
        if (result.success && result.data) {
          setFeeData(result.data);
          setMntDiscountEnabled(result.data.mntDiscount || false);
        }
      } catch (error) {
        notifyError(tt('loadFeeRatesFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchFeeRates();
  }, [accessToken]);

  // Volume-based fee tier (GET /user/fee-tier) for spot tier and progress to next
  useEffect(() => {
    const fetchVolumeTier = async () => {
      if (!accessToken) return;
      try {
        const res = await fetch(`${apiUrl}/api/v1/user/fee-tier`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const result = await res.json();
        if (result.success && result.data) setVolumeTier(result.data);
      } catch {
        // Optional; do not block page
      }
    };
    fetchVolumeTier();
  }, [accessToken, apiUrl]);

  // Toggle MNT discount
  const toggleMntDiscount = async () => {
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/fee-rates/mnt-discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ enabled: !mntDiscountEnabled }),
      });
      const result = await response.json();

      if (!response.ok) {
        const msg = response.status === 404
          ? tt('mntDiscountNotAvailable')
          : (result?.error?.message || tt('updateMntDiscountFailed'));
        notifyError(msg);
        return;
      }
      if (result.success) {
        setMntDiscountEnabled(!mntDiscountEnabled);
      } else {
        notifyError(result.error?.message || tt('updateMntDiscountFailed'));
      }
    } catch {
      notifyError(tt('updateMntDiscountRetry'));
    }
  };

  // Calculate discounted fees
  const getDiscountedFee = (fee: number, discountPercent: number) => {
    if (!mntDiscountEnabled) return fee;
    return fee * (1 - discountPercent / 100);
  };

  // VIP requirements for next level
  const vipRequirements: VipRequirement[] = useMemo(
    () => [
      {
        id: 'spot-volume',
        title: tf('requirements.spot-volume.title'),
        helpText: tf('requirements.spot-volume.helpText'),
        current: feeData.tradingVolume30d,
        required: 1000000,
        unit: 'USD',
        link: '/orders',
        linkText: tf('requirements.spot-volume.linkText'),
      },
      {
        id: 'total-equity',
        title: tf('requirements.total-equity.title'),
        current: feeData.totalEquity,
        required: 100000,
        unit: 'USD',
        link: '/wallet',
        linkText: tf('requirements.total-equity.linkText'),
      },
      {
        id: 'avg-equity',
        title: tf('requirements.avg-equity.title'),
        current: feeData.avgEquity30d,
        required: 100000,
        unit: 'USD',
        link: '/wallet',
        linkText: tf('requirements.avg-equity.linkText'),
      },
    ],
    [feeData.tradingVolume30d, feeData.totalEquity, feeData.avgEquity30d, tf],
  );

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatFee = (fee: number) => {
    return fee.toFixed(4) + ' %';
  };

  // Toggle Switch Component
  const Toggle = ({ enabled, onChange }: { enabled: boolean; onChange: () => void }) => (
    <button
      onClick={onChange}
      className={`relative w-12 h-6 rounded-full transition-colors ${
        enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 bg-card rounded-full transition-all shadow ${
          enabled ? 'right-0.5' : 'left-0.5'
        }`}
      />
    </button>
  );

  // Progress Bar Component
  const ProgressBar = ({ current, required }: { current: number; required: number }) => {
    const percentage = Math.min((current / required) * 100, 100);
    return (
      <div className="w-full bg-accent rounded-full h-1.5 mt-2">
        <div
          className="bg-primary h-1.5 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    );
  };

  return (
    <div className="min-h-full bg-background">
      <div>
        {/* Header */}
        <div className="mb-3">
          <h1 className="text-xl font-semibold text-foreground">{tf('title')}</h1>
        </div>

        {/* Volume-based spot tier (from fee_tiers table) */}
        {volumeTier && (
          <div className="mb-6 p-4 rounded-xl bg-card border border-border" aria-label="Spot volume fee tier">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">{tf('spotVolumeTier')}</h3>
            <p className="text-lg font-semibold text-foreground">{volumeTier.tierName ?? tf('tierFallback', { level: volumeTier.tierLevel })}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {tf('makerTaker', {
                maker: (Number(volumeTier.maker) * 100).toFixed(2),
                taker: (Number(volumeTier.taker) * 100).toFixed(2),
              })}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {tf('volume30d', { volume: formatNumber(Number(volumeTier.volume30d)) })}
            </p>
            {volumeTier.nextTierMinVolume && (
              <div className="mt-2">
                <p className="text-xs text-muted-foreground">{tf('progressNextTier')}</p>
                <ProgressBar
                  current={Number(volumeTier.volume30d)}
                  required={Number(volumeTier.nextTierMinVolume)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  {tf('nextTierAt', { volume: formatNumber(Number(volumeTier.nextTierMinVolume)) })}
                </p>
              </div>
            )}
          </div>
        )}

        {/* VIP Level Card */}
        <div className="bg-gradient-to-br from-blue-600 to-blue-700 dark:from-[#1e2329] dark:to-[#181a20] rounded-xl overflow-hidden mb-8 shadow-lg shadow-blue-500/20 dark:shadow-none">
          <div className="p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: VIP Info */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-card/20 dark:bg-blue-500/20 rounded-full flex items-center justify-center" aria-hidden="true">
                  <Award className="w-8 h-8 text-white dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-blue-100 dark:text-muted-foreground">{tf('myFeeLevel')}</p>
                  <h2 className="text-2xl font-bold text-white">{feeData.vipLevelName}</h2>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-6 mt-6 border-b border-white/20 dark:border-border">
              <button
                onClick={() => setActiveTab('trading')}
                className={`pb-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'trading'
                    ? 'text-white'
                    : 'text-blue-200 dark:text-muted-foreground hover:text-white dark:hover:text-gray-300'
                }`}
              >
                {tf('tabTrading')}
                {activeTab === 'trading' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-card dark:bg-primary" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('interest')}
                className={`pb-3 text-sm font-medium transition-colors relative ${
                  activeTab === 'interest'
                    ? 'text-white'
                    : 'text-blue-200 dark:text-muted-foreground hover:text-white dark:hover:text-gray-300'
                }`}
              >
                {tf('tabInterest')}
                {activeTab === 'interest' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-card dark:bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeTab === 'trading' ? (
            <div className="px-6 lg:px-8 pb-8">
              {/* Spot Trading Fees */}
              <div className="bg-card rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{tf('spot')}</h3>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="text-sm text-muted-foreground">{tf('mntDiscount')}</span>
                      <Toggle enabled={mntDiscountEnabled} onChange={toggleMntDiscount} />
                    </div>
                  </div>
                </div>

                {/* Fee Table */}
                <div className="grid grid-cols-2 gap-8 mb-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{tf('maker')}</p>
                    <p className="text-xl font-bold text-foreground">
                      {formatFee(getDiscountedFee(feeData.spotFees.maker, mntDiscountEnabled ? 25 : 0))}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{tf('taker')}</p>
                    <p className="text-xl font-bold text-foreground">
                      {formatFee(getDiscountedFee(feeData.spotFees.taker, mntDiscountEnabled ? 25 : 0))}
                    </p>
                  </div>
                </div>

                {/* Fiat Pairs */}
                {feeData.spotFees.fiatMaker !== undefined && (
                  <div className="grid grid-cols-2 gap-8 mb-6 pt-4 border-t border-border">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{tf('fiatPairsMaker')}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatFee(getDiscountedFee(feeData.spotFees.fiatMaker || 0.15, mntDiscountEnabled ? 25 : 0))}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">{tf('fiatPairsTaker')}</p>
                      <p className="text-xl font-bold text-foreground">
                        {formatFee(getDiscountedFee(feeData.spotFees.fiatTaker || 0.2, mntDiscountEnabled ? 25 : 0))}
                      </p>
                    </div>
                  </div>
                )}

                {/* Trade Link */}
                <Link
                  href="/trade/spot"
                  className="inline-flex items-center gap-1 text-primary hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium"
                >
                  {tf('tradeSpot')} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* Info Notes */}
              <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                <p>
                  {tf('vipUpdateNote')}
                  <Link href="/dashboard/help#vip-requirements" className="text-primary hover:underline ml-1">
                    {tf('checkRequirements')}
                  </Link>
                </p>
                <p>
                  {tf('viewFiatFees')}
                  <Link href="/dashboard/help#fiat-fees" className="text-primary hover:underline ml-1">
                    {tf('findOutDetails')}
                  </Link>
                </p>
                <p>
                  {tf('mntDiscountNote')}
                  <Link href="/dashboard/help#mnt-discount" className="text-primary hover:underline ml-1">
                    {tf('findOutDetails')}
                  </Link>
                </p>
              </div>
            </div>
          ) : (
            <div className="px-6 lg:px-8 pb-8">
              <div className="bg-card rounded-xl p-6">
                <h3 className="text-lg font-bold text-foreground mb-4">{tf('depositWithdrawTitle')}</h3>
                <p className="text-muted-foreground text-sm mb-6">
                  {tf('depositWithdrawDesc')}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 text-sm font-medium text-muted-foreground">{tf('colAsset')}</th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">{tf('colDepositFee')}</th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">{tf('colWithdrawalFee')}</th>
                        <th className="text-right py-3 text-sm font-medium text-muted-foreground">{tf('colMinWithdrawal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { asset: 'BTC' },
                        { asset: 'ETH' },
                        { asset: 'USDT' },
                        { asset: 'USDC' },
                      ].map((row) => (
                        <tr key={row.asset} className="border-b border-border/50">
                          <td className="py-4 font-medium text-foreground">{row.asset}</td>
                          <td className="py-4 text-right text-buy">{tf('depositFree')}</td>
                          <td className="py-4 text-right text-muted-foreground">{tf('withdrawalNetworkFee')}</td>
                          <td className="py-4 text-right text-muted-foreground">{tf('minVaries')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  {tf('exactFeesNote')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Enjoy Even Lower Fees Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-2xl font-bold text-foreground">{tf('lowerFeesTitle')}</h2>
            <HelpCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">
            {tf('lowerFeesDesc')}{' '}
            <span className="text-primary font-medium">{tf('vip1')}</span> {tf('lowerFeesSuffix')}
          </p>
        </div>

        {/* VIP Requirements Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {vipRequirements.map((req, index) => (
            <div key={req.id} className="relative">
              <div className="bg-card rounded-xl border border-border p-6 h-full">
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-sm font-medium text-foreground pr-6">{req.title}</h3>
                  {req.helpText && (
                    <div className="group relative">
                      <HelpCircle className="w-4 h-4 text-muted-foreground cursor-help" />
                      <div className="hidden group-hover:block absolute right-0 top-6 w-48 p-2 bg-gray-900 text-white text-xs rounded-lg z-10">
                        {req.helpText}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-lg text-muted-foreground mb-2">
                  {formatNumber(req.current)}/{formatNumber(req.required)} {req.unit}
                </p>

                <ProgressBar current={req.current} required={req.required} />

                <Link
                  href={req.link}
                  className="inline-flex items-center gap-1 text-primary hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium mt-4"
                >
                  {req.linkText} <ChevronRight className="w-4 h-4" />
                </Link>
              </div>

              {/* OR Badge */}
              {index < vipRequirements.length - 1 && (
                <div className="hidden md:flex absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                  <span className="px-2 py-1 bg-accent text-muted-foreground text-xs font-medium rounded">
                    {tf('orBadge')}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border pt-8">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
            <Link href="/markets" className="hover:text-foreground dark:hover:text-white">
              {tf('footerMarketOverview')}
            </Link>
            <Link href="/dashboard/fee-rates" className="hover:text-foreground dark:hover:text-white">
              {tf('footerTradingFee')}
            </Link>
            <Link href="/dashboard/api" className="hover:text-foreground dark:hover:text-white">
              {tf('footerApi')}
            </Link>
            <Link href="/dashboard/help" className="hover:text-foreground dark:hover:text-white">
              {tf('footerHelpCenter')}
            </Link>
            <span>{tf('footerCopyright')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
