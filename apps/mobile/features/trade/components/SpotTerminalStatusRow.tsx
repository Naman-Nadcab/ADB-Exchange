import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { StatusChip } from '@shared/ui';
import type { SpotWsStreamPhase } from '@core/domain/trade/marketPulse';
import { streamPhaseToChip } from '@core/domain/trade/marketPulse';
import type { MarketContext, MarketPulse } from '@core/domain/trade/marketPulse';

type Props = {
  streamPhase: SpotWsStreamPhase;
  lastRttMs: number | null;
  liteMode?: boolean;
  liteHint?: string;
  marketTradingOpen: boolean;
  effectiveMarketStatus: string;
  isAuth: boolean;
  privateChannelsReady: boolean;
  reconnectAttempt: number;
  marketContext: MarketContext;
  marketPulse: MarketPulse;
};

export function SpotTerminalStatusRow({
  streamPhase,
  lastRttMs,
  liteMode = false,
  liteHint,
  marketTradingOpen,
  effectiveMarketStatus,
  isAuth,
  privateChannelsReady,
  reconnectAttempt,
  marketContext,
  marketPulse,
}: Props) {
  const { theme } = useTheme();
  const stream = streamPhaseToChip(streamPhase);
  const marketLabel = marketTradingOpen ? 'Market Open' : `Status ${effectiveMarketStatus}`;
  const marketTone = marketTradingOpen ? 'live' : 'warn';

  return (
    <View style={[styles.wrap, { borderTopColor: `hsl(${theme.colors.borderDefault} / 0.8)`, backgroundColor: `hsl(${theme.colors.backgroundPanel} / 0.35)` }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <StatusChip label={stream.label} tone={stream.tone} pulse={stream.pulse} />
        <StatusChip label={marketLabel} tone={marketTone} />
        {liteMode ? (
          <StatusChip label="Adaptive" tone="sync" pulse />
        ) : streamPhase === 'live' ? (
          <StatusChip
            label={lastRttMs != null && lastRttMs >= 0 ? `${lastRttMs}ms` : 'Full rate'}
            tone="neutral"
          />
        ) : null}
        {streamPhase === 'reconnecting' && reconnectAttempt > 0 ? (
          <StatusChip label={`Retry ${reconnectAttempt}`} tone="sync" pulse />
        ) : null}
        {isAuth && streamPhase === 'live' && !privateChannelsReady ? (
          <StatusChip label="Account syncing" tone="sync" pulse />
        ) : null}
        {marketContext ? (
          <View style={styles.context}>
            <Text style={[styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              24H Pos{' '}
              <Text style={[styles.metaVal, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                {marketContext.positionPct.toFixed(1)}%
              </Text>
            </Text>
            <Text style={[styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              H{' '}
              <Text style={[styles.metaVal, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                {Number.isFinite(marketContext.distFromHighPct) ? `${marketContext.distFromHighPct.toFixed(2)}%` : '—'}
              </Text>
            </Text>
            <Text style={[styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
              L{' '}
              <Text style={[styles.metaVal, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                {Number.isFinite(marketContext.distFromLowPct) ? `${marketContext.distFromLowPct.toFixed(2)}%` : '—'}
              </Text>
            </Text>
          </View>
        ) : null}
        <Text style={[styles.meta, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Pulse{' '}
          <Text style={[styles.metaVal, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {marketPulse.momentum}/{marketPulse.liquidity}
          </Text>
        </Text>
        {liteHint ? (
          <Text style={[styles.hint, { color: `hsl(${theme.colors.foregroundSecondary})` }]} numberOfLines={1}>
            {liteHint}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4, paddingVertical: 6, minHeight: 28 },
  context: { flexDirection: 'row', gap: 8, marginLeft: 4 },
  meta: { fontSize: 10, fontWeight: '500' },
  metaVal: { fontFamily: 'IBMPlexMono_500Medium', fontWeight: '600' },
  hint: { fontSize: 9, maxWidth: 120 },
});
