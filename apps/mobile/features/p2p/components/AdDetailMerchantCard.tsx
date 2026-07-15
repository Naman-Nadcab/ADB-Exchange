import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { MerchantBadge } from '@shared/ui';
import type { P2PAd } from '@exchange/mobile-types';
import { merchantLevelLabel, merchantStatsRows } from '@core/domain/p2p/adDetail';

type Props = {
  ad: P2PAd;
  onPress?: () => void;
};

export function AdDetailMerchantCard({ ad, onPress }: Props) {
  const { theme } = useTheme();
  const level = merchantLevelLabel(ad);
  const stats = merchantStatsRows(ad);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[
        styles.card,
        {
          borderColor: `hsl(${theme.colors.borderDefault})`,
          backgroundColor: `hsl(${theme.colors.backgroundElevated})`,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={[styles.avatar, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)` }]}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '800' }}>
            {(ad.username || 'M').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: `hsl(${theme.colors.foregroundPrimary})` }}>
              {ad.username || 'Merchant'}
            </Text>
            {ad.verified_merchant ? (
              <MerchantBadge completionRate={Number(ad.merchant_completion_rate) || 0} verified />
            ) : null}
          </View>
          {level ? (
            <Text style={{ fontSize: 12, color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', marginTop: 2 }}>
              {level}
            </Text>
          ) : null}
        </View>
        {onPress ? (
          <Ionicons name="chevron-forward" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
        ) : null}
      </View>
      <View style={styles.statsGrid}>
        {stats.map((s) => (
          <View key={s.label} style={styles.statCell}>
            <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})` }}>{s.label}</Text>
            <Text style={{ fontSize: 13, fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 2 }}>
              {s.value}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 12, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 14 },
  statCell: { minWidth: '42%' },
});
