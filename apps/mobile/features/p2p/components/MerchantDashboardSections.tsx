import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import type { MerchantDashboardStat } from '@core/domain/p2p/merchant';

type Props = {
  stats: MerchantDashboardStat[];
  verified?: boolean;
};

export function MerchantDashboardHeader({ verified }: { verified?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Merchant dashboard</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13, lineHeight: 18, marginTop: 4 }}>
          Snapshot of your P2P performance. Stats come from your merchant profile; volume sums completed orders loaded in this session.
        </Text>
      </View>
      <View style={[styles.badge, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}>
        <Ionicons name="star-outline" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
        <Text style={{ fontSize: 11, fontWeight: '600', color: `hsl(${theme.colors.foregroundSecondary})` }}>
          {verified ? 'Verified merchant' : 'P2P merchant'}
        </Text>
      </View>
    </View>
  );
}

function StatCard({ stat, theme }: { stat: MerchantDashboardStat; theme: ReturnType<typeof useTheme>['theme'] }) {
  return (
    <View style={[styles.card, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, textTransform: 'uppercase' }}>
        {stat.label}
      </Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 8 }}>
        {stat.value}
      </Text>
      {stat.progress != null ? (
        <View style={{ marginTop: 10 }}>
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min(100, Math.max(0, stat.progress))}%`, backgroundColor: `hsl(${theme.colors.tradeBuy})` },
              ]}
            />
          </View>
          <Text style={{ fontSize: 11, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 4 }}>Progress vs 95%+ target</Text>
        </View>
      ) : null}
      {stat.sub ? (
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 6 }}>{stat.sub}</Text>
      ) : null}
    </View>
  );
}

export function MerchantStatGrid({ stats }: Props) {
  const { theme } = useTheme();
  return (
    <View style={styles.grid}>
      {stats.map((stat) => (
        <View key={stat.key} style={styles.gridItem}>
          <StatCard stat={stat} theme={theme} />
        </View>
      ))}
    </View>
  );
}

export function MerchantVolumePanel({ volume }: { volume: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.volume, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
        <View style={[styles.volumeIcon, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
          <Ionicons name="cash-outline" size={22} color={`hsl(${theme.colors.brandPrimary})`} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: `hsl(${theme.colors.foregroundSecondary})`, textTransform: 'uppercase' }}>
            Approx. fiat volume
          </Text>
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>
            Sum of fiat from completed orders in the list loaded for this page.
          </Text>
        </View>
      </View>
      <Text style={{ fontSize: 28, fontWeight: '800', color: `hsl(${theme.colors.foregroundPrimary})`, marginTop: 12 }}>
        {volume.toFixed(2)}
      </Text>
    </View>
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
    <Pressable
      onPress={onPress}
      style={[styles.link, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}
    >
      <View style={[styles.linkIcon, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.1)` }]}>
        <Ionicons name={icon} size={20} color={`hsl(${theme.colors.brandPrimary})`} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>{title}</Text>
        <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: 2 }}>{subtitle}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
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
  const rows = [
    { label: 'Active ads', value: active, color: '#0ecb81' },
    { label: 'Paused ads', value: paused, color: '#f59e0b' },
    { label: 'Completed ads', value: completed, color: `hsl(${theme.colors.foregroundSecondary})` },
    { label: 'Cancelled ads', value: cancelled, color: '#f6465d' },
  ];
  return (
    <View style={[styles.breakdown, { borderColor: `hsl(${theme.colors.borderDefault})`, backgroundColor: `hsl(${theme.colors.backgroundElevated})` }]}>
      <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: 10 }}>Your listings</Text>
      {rows.map((row) => (
        <View key={row.label} style={styles.breakdownRow}>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{row.label}</Text>
          <Text style={{ fontWeight: '800', color: row.color, fontSize: 16 }}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  gridItem: { width: '48%' },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, minHeight: 120 },
  progressTrack: { height: 6, borderRadius: 999, backgroundColor: 'rgba(120,120,120,0.15)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  volume: { borderWidth: 1, borderRadius: 14, padding: 16, marginBottom: 12 },
  volumeIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 10 },
  linkIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  breakdown: { borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 12 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
});
