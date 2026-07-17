import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, MerchantBadge } from '@shared/ui';
import { useTheme } from '@shared/theme';
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
    <Pressable onPress={onPress} disabled={!onPress}>
      <ExchangeCard style={{ marginBottom: theme.spacing[3] }}>
        <View style={[styles.row, { gap: theme.spacing[3] }]}>
          <View
            style={[
              styles.avatar,
              {
                width: 44,
                height: 44,
                borderRadius: theme.radius.full,
                backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)`,
              },
            ]}
          >
            <Text
              style={[
                theme.typography.bodyMd,
                { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold },
              ]}
            >
              {(ad.username || 'M').slice(0, 1).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={[styles.nameRow, { gap: theme.spacing[1.5] }]}>
              <Text
                style={[
                  theme.typography.headingSm,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
                ]}
              >
                {ad.username || 'Merchant'}
              </Text>
              {ad.verified_merchant ? (
                <MerchantBadge completionRate={Number(ad.merchant_completion_rate) || 0} verified />
              ) : null}
            </View>
            {level ? (
              <Text
                style={[
                  theme.typography.bodySm,
                  {
                    color: `hsl(${theme.colors.brandPrimary})`,
                    fontFamily: theme.fonts.sansSemiBold,
                    marginTop: theme.spacing[0.5],
                  },
                ]}
              >
                {level}
              </Text>
            ) : null}
          </View>
          {onPress ? (
            <Ionicons name="chevron-forward" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
          ) : null}
        </View>
        <View style={[styles.statsGrid, { gap: theme.spacing[3], marginTop: theme.spacing[3.5] }]}>
          {stats.map((s) => (
            <View key={s.label} style={styles.statCell}>
              <Text style={[theme.typography.labelSm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{s.label}</Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  {
                    color: `hsl(${theme.colors.foregroundPrimary})`,
                    fontFamily: theme.fonts.sansBold,
                    marginTop: theme.spacing[0.5],
                  },
                ]}
              >
                {s.value}
              </Text>
            </View>
          ))}
        </View>
      </ExchangeCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  statCell: { minWidth: '42%' },
});
