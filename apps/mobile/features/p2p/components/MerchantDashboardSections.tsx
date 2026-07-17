import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import type { MerchantDashboardStat } from '@core/domain/p2p/merchant';

type Props = {
  stats: MerchantDashboardStat[];
  verified?: boolean;
};

export function MerchantDashboardHeader({ verified }: { verified?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.header, { gap: theme.spacing[3], marginBottom: theme.spacing[4] }]}>
      <View style={{ flex: 1 }}>
        <Text
          style={[
            theme.typography.displayMd,
            { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
          ]}
        >
          Merchant dashboard
        </Text>
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
          ]}
        >
          Snapshot of your P2P performance. Stats come from your merchant profile; volume sums completed orders loaded in this session.
        </Text>
      </View>
      <View
        style={[
          styles.badge,
          {
            borderColor: `hsl(${theme.colors.borderDefault})`,
            backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
            borderRadius: theme.radius.md,
            paddingHorizontal: theme.spacing[2.5],
            paddingVertical: theme.spacing[1.5],
            gap: theme.spacing[1.5],
          },
        ]}
      >
        <Ionicons name="star-outline" size={theme.sizes.iconSm} color={`hsl(${theme.colors.brandPrimary})`} />
        <Text
          style={[
            theme.typography.labelSm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, fontFamily: theme.fonts.sansSemiBold },
          ]}
        >
          {verified ? 'Verified merchant' : 'P2P merchant'}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ stat }: { stat: MerchantDashboardStat }) {
  const { theme } = useTheme();
  return (
    <ExchangeCard style={{ minHeight: 120 }}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            textTransform: 'uppercase',
          },
        ]}
      >
        {stat.label}
      </Text>
      <Text
        style={[
          theme.typography.displayMd,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sansBold,
            marginTop: theme.spacing[2],
          },
        ]}
      >
        {stat.value}
      </Text>
      {stat.progress != null ? (
        <View style={{ marginTop: theme.spacing[2.5] }}>
          <View
            style={[
              styles.progressTrack,
              {
                borderRadius: theme.radius.full,
                backgroundColor: `hsl(${theme.colors.surfaceMuted})`,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, Math.max(0, stat.progress))}%`,
                  backgroundColor: `hsl(${theme.colors.tradeBuy})`,
                  borderRadius: theme.radius.full,
                },
              ]}
            />
          </View>
          <Text
            style={[
              theme.typography.labelSm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1] },
            ]}
          >
            Progress vs 95%+ target
          </Text>
        </View>
      ) : null}
      {stat.sub ? (
        <Text
          style={[
            theme.typography.bodySm,
            { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[1.5] },
          ]}
        >
          {stat.sub}
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

export function MerchantStatGrid({ stats }: Props) {
  const { theme } = useTheme();
  return (
    <View style={[styles.grid, { gap: theme.spacing[2.5], marginBottom: theme.spacing[3] }]}>
      {stats.map((stat) => (
        <View key={stat.key} style={styles.gridItem}>
          <StatCard stat={stat} />
        </View>
      ))}
    </View>
  );
}

export function MerchantVolumePanel({ volume }: { volume: number }) {
  const { theme } = useTheme();
  return (
    <ExchangeCard style={{ marginBottom: theme.spacing[3] }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[3], flex: 1 }}>
        <View
          style={[
            styles.volumeIcon,
            {
              width: 44,
              height: 44,
              borderRadius: theme.radius.lg,
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
            },
          ]}
        >
          <Ionicons name="cash-outline" size={theme.sizes.iconMd} color={`hsl(${theme.colors.brandPrimary})`} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansBold,
                textTransform: 'uppercase',
              },
            ]}
          >
            Approx. fiat volume
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
            ]}
          >
            Sum of fiat from completed orders in the list loaded for this page.
          </Text>
        </View>
      </View>
      <Text
        style={[
          theme.typography.displayMd,
          {
            color: `hsl(${theme.colors.foregroundPrimary})`,
            fontFamily: theme.fonts.sansBold,
            marginTop: theme.spacing[3],
          },
        ]}
      >
        {volume.toFixed(2)}
      </Text>
    </ExchangeCard>
  );
}

type LinkProps = {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
};

export function MerchantQuickLink({ title, subtitle, icon, onPress }: LinkProps) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress}>
      <ExchangeCard
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing[3],
          marginBottom: theme.spacing[2.5],
        }}
      >
        <View
          style={[
            styles.linkIcon,
            {
              width: 44,
              height: 44,
              borderRadius: theme.radius.lg,
              backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)`,
            },
          ]}
        >
          <Ionicons name={icon} size={theme.sizes.iconMd} color={`hsl(${theme.colors.brandPrimary})`} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundSecondary})`} />
      </ExchangeCard>
    </Pressable>
  );
}

export function MerchantAdBreakdown({
  active,
  paused,
  completed,
  cancelled,
}: {
  active: number;
  paused: number;
  completed: number;
  cancelled: number;
}) {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');
  const warning = semanticStatusPalette(theme.colors, 'warning');
  const error = semanticStatusPalette(theme.colors, 'error');
  const rows = [
    { label: 'Active ads', value: active, color: success.fg },
    { label: 'Paused ads', value: paused, color: warning.fg },
    { label: 'Completed ads', value: completed, color: `hsl(${theme.colors.foregroundSecondary})` },
    { label: 'Cancelled ads', value: cancelled, color: error.fg },
  ];
  return (
    <ExchangeCard style={{ marginBottom: theme.spacing[3] }}>
      <Text
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[2.5] },
        ]}
      >
        Your listings
      </Text>
      {rows.map((row) => (
        <View key={row.label} style={[styles.breakdownRow, { paddingVertical: theme.spacing[1.5] }]}>
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{row.label}</Text>
          <Text
            style={[
              theme.typography.headingSm,
              { color: row.color, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {row.value}
          </Text>
        </View>
      ))}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  header: {},
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', borderWidth: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  gridItem: { width: '48%' },
  progressTrack: { height: 6, overflow: 'hidden' },
  progressFill: { height: '100%' },
  volumeIcon: { alignItems: 'center', justifyContent: 'center' },
  linkIcon: { alignItems: 'center', justifyContent: 'center' },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
