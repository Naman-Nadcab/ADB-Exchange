import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { formatUsd, formatCryptoAmount, maskBalance } from '@core/domain/wallet/portfolio';
import type { EquityTotal } from '@exchange/mobile-types';

type CardProps = {
  label: string;
  subtitle: string;
  usd: EquityTotal;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  showBalances: boolean;
};

function EquityCard({ label, subtitle, usd, icon, iconBg, iconColor, showBalances }: CardProps) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <ExchangeCard elevated style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View>
          <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 10 }}>{subtitle}</Text>
        </View>
      </View>
      <Text style={[styles.amount, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        ${mask(formatUsd(usd.usd))}
      </Text>
      {usd.btc ? (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 4 }}>
          ≈ {mask(formatCryptoAmount(usd.btc))} BTC
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

type Props = {
  totalEquity: EquityTotal;
  availableBalance: EquityTotal;
  inUse: EquityTotal;
  showBalances: boolean;
};

export function FundingEquitySummary({ totalEquity, availableBalance, inUse, showBalances }: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <EquityCard
        label="TOTAL EQUITY"
        subtitle="Funding wallet (USD)"
        usd={totalEquity}
        icon="wallet-outline"
        iconBg={`hsl(${theme.colors.brandPrimary} / 0.12)`}
        iconColor={`hsl(${theme.colors.brandPrimary})`}
        showBalances={showBalances}
      />
      <EquityCard
        label="AVAILABLE"
        subtitle="Ready to trade or withdraw"
        usd={availableBalance}
        icon="arrow-up-outline"
        iconBg={`hsl(${theme.colors.tradeBuy} / 0.12)`}
        iconColor={`hsl(${theme.colors.tradeBuy})`}
        showBalances={showBalances}
      />
      <EquityCard
        label="IN USE"
        subtitle="Locked in orders or pending"
        usd={inUse}
        icon="time-outline"
        iconBg="rgba(245,158,11,0.12)"
        iconColor="#f59e0b"
        showBalances={showBalances}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, marginBottom: 14 },
  card: { padding: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  iconWrap: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  amount: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
