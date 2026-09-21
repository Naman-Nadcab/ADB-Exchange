'use client';

import { useTranslations } from 'next-intl';
import { TerminalStatusChip, streamPhaseToChip } from './TerminalStatusChip';
import type { SpotWsStreamPhase } from '@/hooks/useSpotWs';

type MarketContext = {
  positionPct: number;
  distFromHighPct: number;
  distFromLowPct: number;
} | null;

type MarketPulse = {
  momentum: string;
  liquidity: string;
};

export function SpotTerminalStatusRow({
  streamPhase,
  lastRttMs,
  liteMode,
  liteHint,
  marketTradingOpen,
  effectiveMarketStatus,
  isAuth,
  privateChannelsReady,
  preferencesSyncIssue,
  bootstrapIssue,
  reconnectAttempt,
  marketContext,
  marketPulse,
}: {
  streamPhase: SpotWsStreamPhase;
  lastRttMs: number | null;
  liteMode: boolean;
  liteHint?: string;
  marketTradingOpen: boolean;
  effectiveMarketStatus: string;
  isAuth: boolean;
  privateChannelsReady: boolean;
  preferencesSyncIssue?: boolean;
  bootstrapIssue?: string | null;
  reconnectAttempt: number;
  marketContext: MarketContext;
  marketPulse: MarketPulse;
}) {
  const t = useTranslations('crypto');
  const stream = streamPhaseToChip(streamPhase);
  const streamTitle =
    streamPhase === 'live' && lastRttMs != null && lastRttMs >= 0
      ? `Market stream connected · RTT ~${lastRttMs}ms`
      : streamPhase === 'reconnecting' && reconnectAttempt > 0
        ? `Reconnecting (attempt ${reconnectAttempt})`
        : streamPhase === 'connecting'
          ? 'Connecting to market stream'
          : streamPhase === 'disconnected'
            ? 'Market stream offline'
            : undefined;

  const marketLabel = marketTradingOpen ? 'Market Open' : `Status ${effectiveMarketStatus}`;
  const marketTone = marketTradingOpen ? 'live' : 'warn';

  return (
    <div className="flex min-h-6 flex-wrap items-center gap-1.5 border-t border-border/80 bg-muted/20 px-2 py-1">
      <TerminalStatusChip
        label={stream.label}
        tone={stream.tone}
        pulse={stream.pulse}
        title={streamTitle}
      />
      <TerminalStatusChip label={marketLabel} tone={marketTone as 'live' | 'warn'} />
      {liteMode ? (
        <TerminalStatusChip label="Adaptive" tone="sync" title={liteHint ?? 'Reduced stream rate'} pulse />
      ) : streamPhase === 'live' ? (
        <TerminalStatusChip
          label={lastRttMs != null && lastRttMs >= 0 ? `${lastRttMs}ms` : t('status.fullRate')}
          tone="neutral"
          title={t('status.streamLatency')}
        />
      ) : null}
      {isAuth && streamPhase === 'live' && !privateChannelsReady ? (
        <TerminalStatusChip label={t('status.accountSyncing')} tone="sync" pulse title={t('status.accountSyncingTitle')} />
      ) : null}
      {isAuth && streamPhase === 'live' && preferencesSyncIssue && privateChannelsReady ? (
        <TerminalStatusChip
          label={t('status.prefsDelayed')}
          tone="warn"
          title="Preference sync delayed. Default confirmation rules are active."
        />
      ) : null}
      {streamPhase === 'live' && bootstrapIssue && privateChannelsReady && !preferencesSyncIssue ? (
        <TerminalStatusChip label={t('status.bootstrapNotice')} tone="warn" title={bootstrapIssue} />
      ) : null}
      {marketContext ? (
        <div className="ml-auto flex flex-wrap items-center gap-2 terminal-text-meta leading-none text-muted-foreground">
          <span>
            24H Pos{' '}
            <span className="numeric font-medium text-foreground">{marketContext.positionPct.toFixed(1)}%</span>
          </span>
          <span>
            H{' '}
            <span className="numeric font-medium text-foreground">
              {Number.isFinite(marketContext.distFromHighPct) ? `${marketContext.distFromHighPct.toFixed(2)}%` : '—'}
            </span>
          </span>
          <span>
            L{' '}
            <span className="numeric font-medium text-foreground">
              {Number.isFinite(marketContext.distFromLowPct) ? `${marketContext.distFromLowPct.toFixed(2)}%` : '—'}
            </span>
          </span>
        </div>
      ) : null}
      <span className={`terminal-text-meta text-muted-foreground ${marketContext ? '' : 'ml-auto'}`}>
        Pulse{' '}
        <span className="numeric font-medium text-foreground">{marketPulse.momentum}</span>/
        <span className="numeric font-medium text-foreground">{marketPulse.liquidity}</span>
      </span>
    </div>
  );
}
