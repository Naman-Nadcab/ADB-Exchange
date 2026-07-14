import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, hapticLight } from '@shared/theme';
import { formatPrice, formatChangePct, changeColorKey } from '@core/domain/markets/formatPrice';
import { PriceFlashText, TerminalPanel, StatusChip } from '@shared/ui';
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
  const direction = ck === 'buy' ? 'up' : ck === 'sell' ? 'down' : 'neutral';

  return (
    <TerminalPanel style={styles.wrap}>
      <View style={styles.topRow}>
        <Pressable onPress={onSwitchPair} accessibilityRole="button" accessibilityLabel="Switch trading pair" style={styles.pairBtn}>
          <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {ticker?.base_asset ?? symbol.split('_')[0]}
            <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '400' }}>
              /{ticker?.quote_asset ?? symbol.split('_')[1]}
            </Text>
          </Text>
          <Ionicons name="chevron-down" size={16} color={`hsl(${theme.colors.foregroundSecondary})`} />
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
              size={20}
              color={`hsl(${theme.colors.brandPrimary})`}
            />
          </Pressable>
          <StatusChip
            label={wsState === 'connected' ? 'Live' : wsState === 'reconnecting' ? 'Syncing' : 'Offline'}
            tone={wsState === 'connected' ? 'live' : wsState === 'reconnecting' ? 'sync' : 'off'}
          />
        </View>
      </View>

      <PriceFlashText value={formatPrice(price, ticker?.quote_asset ?? 'USDT')} direction={direction} size="xl" />

      <View style={styles.statsRow}>
        <Text
          style={{
            color: `hsl(${direction === 'up' ? theme.colors.tradeBuy : direction === 'down' ? theme.colors.tradeSell : theme.colors.foregroundSecondary})`,
            fontWeight: '600',
            fontSize: 14,
          }}
        >
          {formatChangePct(change)}
        </Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          H {formatPrice(Number(ticker?.high_24h ?? 0), '')}
        </Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          L {formatPrice(Number(ticker?.low_24h ?? 0), '')}
        </Text>
        <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Vol {Number(ticker?.volume_24h ?? 0).toLocaleString(undefined, { notation: 'compact' })}
        </Text>
      </View>
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 12 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  pairBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 8, alignItems: 'center' },
});
