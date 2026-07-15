import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, ChangeLabel, PriceLabel } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';

type Props = {
  symbol: string;
  name: string;
  image?: string;
  rank?: number | null;
  price?: number | null;
  change24h?: number | null;
  holdingsUsd: string;
  showBalances: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  priceStale?: boolean;
};

export function AssetDetailHeader({
  symbol,
  name,
  image,
  rank,
  price,
  change24h,
  holdingsUsd,
  showBalances,
  isFavorite,
  onToggleFavorite,
  priceStale,
}: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <View style={styles.wrap}>
      <View style={styles.topRow}>
        <Avatar name={symbol} uri={image} size="lg" />
        <View style={styles.meta}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{name}</Text>
            {rank ? (
              <View style={[styles.rank, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
                <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '700' }}>
                  #{rank}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontWeight: '600' }}>{symbol}</Text>
        </View>
        {onToggleFavorite ? (
          <Pressable onPress={onToggleFavorite} hitSlop={10} accessibilityLabel="Toggle favorite">
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 22 }}>{isFavorite ? '★' : '☆'}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.priceRow}>
        {price != null ? (
          <>
            <PriceLabel value={price} size="lg" />
            {change24h != null ? <ChangeLabel changePct={change24h} /> : null}
          </>
        ) : (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 14 }}>Price unavailable</Text>
        )}
        {priceStale ? (
          <View style={styles.staleRow}>
            <Ionicons name="warning-outline" size={14} color={`hsl(${theme.colors.statusWarning})`} />
            <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 11 }}>Price may be stale</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.holdingsCard, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.45)` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
          HOLDINGS VALUE
        </Text>
        <Text style={[styles.holdingsValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          ${mask(formatUsd(holdingsUsd))}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  meta: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  rank: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  staleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  holdingsCard: { marginTop: 14, padding: 14, borderRadius: 12, gap: 4 },
  holdingsValue: { fontSize: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
