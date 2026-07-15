import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import type { WithdrawalLimits } from '@exchange/mobile-types';

type Props = {
  limits?: WithdrawalLimits;
  symbol: string;
  loading?: boolean;
};

export function WithdrawLimitsCard({ limits, symbol, loading }: Props) {
  const { theme } = useTheme();

  if (loading) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Loading limits…</Text>
      </ExchangeCard>
    );
  }

  if (!limits) return null;

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>WITHDRAWAL LIMITS</Text>
      <LimitRow label="Daily remaining" value={`${limits.daily.remaining} ${symbol}`} sub={`Used ${limits.daily.used} / ${limits.daily.limit}`} pct={limits.daily.percentage} />
      <LimitRow label="Monthly remaining" value={`${limits.monthly.remaining} ${symbol}`} sub={`Used ${limits.monthly.used} / ${limits.monthly.limit}`} pct={limits.monthly.percentage} />
      {limits.vipLevel > 0 ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginTop: 6 }}>
          VIP level {limits.vipLevel}
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

function LimitRow({ label, value, sub, pct }: { label: string; value: string; sub: string; pct: string }) {
  const { theme } = useTheme();
  const p = parseFloat(pct) || 0;
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700' }}>{value}</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>{sub}</Text>
      </View>
      <View style={[styles.barTrack, { backgroundColor: `hsl(${theme.colors.borderDefault})` }]}>
        <View style={[styles.barFill, { width: `${Math.min(100, p)}%`, backgroundColor: `hsl(${theme.colors.brandPrimary})` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  barTrack: { width: 56, height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%' },
});
