import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { formatUsd, maskBalance, type TopHolding } from '@core/domain/wallet/portfolio';

type Props = {
  variant: 'funding' | 'trading';
  totalUsd: string;
  showBalances: boolean;
  holdings: TopHolding[];
};

export function WalletAccountCard({ variant, totalUsd, showBalances, holdings }: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const isFunding = variant === 'funding';

  return (
    <ExchangeCard elevated style={styles.card}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: isFunding
                ? `hsl(${theme.colors.brandPrimary} / 0.12)`
                : 'rgba(245,158,11,0.12)',
            },
          ]}
        >
          <Ionicons
            name={isFunding ? 'wallet-outline' : 'bar-chart-outline'}
            size={20}
            color={isFunding ? `hsl(${theme.colors.brandPrimary})` : '#f59e0b'}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {isFunding ? 'Funding Account' : 'Spot / Trading Account'}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
            {isFunding ? 'Deposits, P2P payouts, withdrawals' : 'Used for spot trading orders'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[styles.total, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            ${mask(formatUsd(totalUsd))}
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>USD</Text>
        </View>
      </View>

      {holdings.length > 0 ? (
        <View style={[styles.holdingsBox, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
          <Text style={[styles.holdingsLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            TOP HOLDINGS
          </Text>
          {holdings.map((h) => (
            <View key={h.symbol} style={styles.holdingRow}>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                {h.symbol}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                {mask(h.amount)}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, minWidth: 72, textAlign: 'right' }}>
                ${mask(formatUsd(h.usd))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 10 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 15, fontWeight: '700' },
  total: { fontSize: 18, fontWeight: '700', fontVariant: ['tabular-nums'] },
  holdingsBox: { marginTop: 12, borderRadius: 10, padding: 10 },
  holdingsLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  holdingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
});
