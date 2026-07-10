import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { useFavorites } from '@features/markets';
import type { SpotTickerDetail } from '@exchange/mobile-types';
import type { WsConnectionState } from '@core/ws/channels';

type Props = {
  symbol: string;
  ticker?: SpotTickerDetail | null;
  livePrice?: number;
  liveChange?: number;
  wsState: WsConnectionState;
  onSwitchPair: () => void;
};

export function PairHeader({ symbol, ticker, livePrice, liveChange, wsState, onSwitchPair }: Props) {
  const { theme } = useTheme();
  const { isFavorite, toggle } = useFavorites();
  const price = livePrice ?? Number(ticker?.last_price ?? 0);
  const change = liveChange ?? Number(ticker?.change_pct ?? 0);
  const ck = changeColorKey(change);
  const changeColor =
    ck === 'buy' ? theme.colors.tradeBuy : ck === 'sell' ? theme.colors.tradeSell : theme.colors.foregroundSecondary;

  return (
    <View style={styles.wrap}>
      <Pressable onPress={onSwitchPair} accessibilityRole="button" accessibilityLabel="Switch trading pair">
        <Text style={[styles.pair, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {ticker?.base_asset ?? symbol.split('_')[0]}/{ticker?.quote_asset ?? symbol.split('_')[1]}
        </Text>
      </Pressable>
      <Text style={[styles.price, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        {formatPrice(price, ticker?.quote_asset ?? 'USDT')}
      </Text>
      <View style={styles.row}>
        <Text style={{ color: `hsl(${changeColor})`, fontWeight: '600' }}>{formatChangePct(change)}</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
          H {formatPrice(Number(ticker?.high_24h ?? 0), '')} L {formatPrice(Number(ticker?.low_24h ?? 0), '')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable onPress={() => toggle(symbol)} accessibilityLabel="Toggle favorite">
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>
            {isFavorite(symbol) ? '★' : '☆'}
          </Text>
        </Pressable>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
          {wsState === 'connected' ? '● Live' : wsState === 'reconnecting' ? '↻ Reconnecting' : '○ Offline'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  pair: { fontSize: 18, fontWeight: '700' },
  price: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'], marginTop: 4 },
  row: { flexDirection: 'row', gap: 12, marginTop: 4, alignItems: 'center' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
