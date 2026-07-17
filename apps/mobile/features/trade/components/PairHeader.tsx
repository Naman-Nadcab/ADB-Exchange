import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { PriceFlashText, TerminalPanel, AccountEntryButton } from '@shared/ui';
import { useFavorites } from '@features/markets';
import type { SpotTickerDetail } from '@exchange/mobile-types';

type Props = {
  symbol: string;
  ticker?: SpotTickerDetail | null;
  livePrice?: number;
  liveChange?: number;
  liveHigh?: number;
  liveLow?: number;
  liveVolume?: number;
  turnover24h?: number;
  baseVolume24h?: number;
  bestBid?: string | null;
  bestAsk?: string | null;
  marketStatus?: string | null;
  onSwitchPair: () => void;
};

function compact(n: number): string {
  return n.toLocaleString(undefined, { notation: 'compact', maximumFractionDigits: 2 });
}

export function PairHeader({
  symbol,
  ticker,
  livePrice,
  liveChange,
  liveHigh,
  liveLow,
  liveVolume,
  turnover24h,
  baseVolume24h,
  bestBid,
  bestAsk,
  marketStatus,
  onSwitchPair,
}: Props) {
  const { theme } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const price = livePrice ?? Number(ticker?.last_price ?? 0);
  const change = liveChange ?? Number(ticker?.change_pct ?? 0);
  const high = liveHigh ?? Number(ticker?.high_24h ?? 0);
  const low = liveLow ?? Number(ticker?.low_24h ?? 0);
  const volume = liveVolume ?? Number(ticker?.volume_24h ?? 0);
  const turnover = turnover24h ?? Number(ticker?.volume_24h ?? 0);
  const baseVol = baseVolume24h ?? Number(ticker?.base_volume_24h ?? 0);
  const bid = bestBid ?? ticker?.bid ?? null;
  const ask = bestAsk ?? ticker?.ask ?? null;
  const spread =
    bid && ask && parseFloat(bid) > 0 && parseFloat(ask) > 0
      ? ((parseFloat(ask) - parseFloat(bid)) / ((parseFloat(ask) + parseFloat(bid)) / 2)) * 100
      : null;
  const ck = changeColorKey(change);
  const direction = ck === 'buy' ? 'up' : ck === 'sell' ? 'down' : 'neutral';
  const quoteAsset = ticker?.quote_asset ?? symbol.split('_')[1] ?? 'USDT';
  const baseAsset = ticker?.base_asset ?? symbol.split('_')[0];

  return (
    <TerminalPanel style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable onPress={onSwitchPair} accessibilityRole="button" accessibilityLabel="Switch trading pair" style={styles.pairBtn}>
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {baseAsset}
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>/{quoteAsset}</Text>
          </Text>
          <Ionicons name="chevron-down" size={theme.sizes.iconSm} color={`hsl(${theme.colors.foregroundSecondary})`} />
        </Pressable>
        <View style={styles.actions}>
          <Pressable
            onPress={() => {
              void hapticLight();
              toggle(symbol);
            }}
            accessibilityLabel="Toggle favorite"
          >
            <Ionicons
              name={isFavorite(symbol) ? 'star' : 'star-outline'}
              size={theme.sizes.iconSm}
              color={`hsl(${theme.colors.brandPrimary})`}
            />
          </Pressable>
          {marketStatus && marketStatus !== 'ACTIVE' ? (
            <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.statusWarning})`, fontFamily: theme.fonts.sansBold, textTransform: 'uppercase' }]}>{marketStatus}</Text>
          ) : null}
          <AccountEntryButton compact size={20} />
        </View>
      </View>

      <PriceFlashText value={formatPrice(price, quoteAsset)} direction={direction} size="xl" />

      <View style={styles.statsRow}>
        <Text
          style={[
            theme.typography.bodyMd,
            {
              color: `hsl(${direction === 'up' ? theme.colors.tradeBuy : direction === 'down' ? theme.colors.tradeSell : theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansSemiBold,
            },
          ]}
        >
          {formatChangePct(change)}
        </Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>H {formatPrice(high, '')}</Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>L {formatPrice(low, '')}</Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Vol {compact(baseVol || volume)}</Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Turnover {compact(turnover)}</Text>
        {bid ? (
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.tradeBuy})` }]}>Bid {formatPrice(parseFloat(bid), '')}</Text>
        ) : null}
        {ask ? (
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.tradeSell})` }]}>Ask {formatPrice(parseFloat(ask), '')}</Text>
        ) : null}
        {spread != null && spread > 0 ? (
          <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Spr {spread.toFixed(3)}%</Text>
        ) : null}
      </View>
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pairBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, alignItems: 'center' },
});
