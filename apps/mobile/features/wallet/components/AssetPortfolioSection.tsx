import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import { formatAssetAmount, type AssetHoldings } from '@core/domain/wallet/assetDetail';

type Props = {
  symbol: string;
  holdings: AssetHoldings;
  priceUsd: number;
  showBalances: boolean;
  loading?: boolean;
};

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${muted ? theme.colors.foregroundSecondary : theme.colors.foregroundPrimary})`,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </View>
  );
}

export function AssetPortfolioSection({ symbol, holdings, priceUsd, showBalances, loading }: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const fiat = (n: number) => mask(formatUsd(n * priceUsd));

  if (loading) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Loading portfolio…</Text>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>PORTFOLIO</Text>

      <View style={[styles.totalCard, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 }}>
          TOTAL HOLDING
        </Text>
        <Text style={[styles.totalAmt, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {mask(formatAssetAmount(holdings.grandTotal, symbol))}
        </Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
          ≈ ${fiat(holdings.grandTotal)}
        </Text>
      </View>

      <View style={styles.grid}>
        <Metric label="Available" value={mask(formatAssetAmount(holdings.totalAvailable, symbol))} sub={`≈ $${fiat(holdings.totalAvailable)}`} />
        <Metric label="Locked" value={mask(formatAssetAmount(holdings.totalLocked, symbol))} sub={`≈ $${fiat(holdings.totalLocked)}`} />
        <Metric label="In Orders" value={mask(formatAssetAmount(holdings.inOrders, symbol))} sub={`≈ $${fiat(holdings.inOrders)}`} />
      </View>

      <View style={[styles.accountBlock, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.accountLabel, { color: `hsl(${theme.colors.brandPrimary})` }]}>Funding</Text>
        <Row label="Total" value={mask(formatAssetAmount(holdings.fundingTotal, symbol))} />
        <Row label="Available" value={mask(formatAssetAmount(holdings.fundingAvailable, symbol))} muted />
        <Row label="Locked" value={mask(formatAssetAmount(holdings.fundingLocked, symbol))} muted />
      </View>

      <View style={[styles.accountBlock, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
        <Text style={[styles.accountLabel, { color: `hsl(${theme.colors.statusWarning})` }]}>Trading</Text>
        <Row label="Total" value={mask(formatAssetAmount(holdings.tradingTotal, symbol))} />
        <Row label="Available" value={mask(formatAssetAmount(holdings.tradingAvailable, symbol))} muted />
        <Row label="In Orders" value={mask(formatAssetAmount(holdings.tradingLocked, symbol))} muted />
      </View>
    </ExchangeCard>
  );
}

function Metric({ label, value, sub }: { label: string; value: string; sub: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.25)` }]}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10, fontWeight: '600' }}>{label}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '700', fontSize: 13 }}>{value}</Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 10 },
  totalCard: { padding: 14, borderRadius: 12, gap: 4, marginBottom: 10 },
  totalAmt: { fontSize: 22, fontWeight: '700' },
  grid: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  metric: { flex: 1, padding: 10, borderRadius: 10, gap: 2 },
  accountBlock: { paddingTop: 12, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, gap: 2 },
  accountLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.6, marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 5 },
});
