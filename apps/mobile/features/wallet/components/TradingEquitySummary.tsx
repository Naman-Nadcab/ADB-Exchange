import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import type { EquityTotal } from '@exchange/mobile-types';

type CardProps = {
  label: string;
  usd: EquityTotal;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  showBalances: boolean;
  trailing?: ReactNode;
};

function EquityCard({ label, usd, icon, iconBg, iconColor, showBalances, trailing }: CardProps) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <ExchangeCard elevated style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
            {trailing}
          </View>
        </View>
      </View>
      <Text style={[styles.amount, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
        ${mask(formatUsd(usd.usd))}
      </Text>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 4 }}>USD</Text>
    </ExchangeCard>
  );
}

type Props = {
  totalEquity: EquityTotal;
  availableBalance: EquityTotal;
  unrealizedPnl: EquityTotal;
  showBalances: boolean;
  onOpenPnl?: () => void;
};

export function TradingEquitySummary({
  totalEquity,
  availableBalance,
  unrealizedPnl,
  showBalances,
  onOpenPnl,
}: Props) {
  const { theme } = useTheme();

  return (
    <View style={styles.wrap}>
      <EquityCard
        label="TOTAL EQUITY"
        usd={totalEquity}
        icon="wallet-outline"
        iconBg={`hsl(${theme.colors.brandPrimary} / 0.12)`}
        iconColor={`hsl(${theme.colors.brandPrimary})`}
        showBalances={showBalances}
        trailing={
          onOpenPnl ? (
            <Pressable
              onPress={onOpenPnl}
              style={[styles.pnlChip, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}
            >
              <Ionicons name="trending-up-outline" size={12} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 11, fontWeight: '700' }}>
                P&L
              </Text>
            </Pressable>
          ) : null
        }
      />
      <EquityCard
        label="AVAILABLE BALANCE"
        usd={availableBalance}
        icon="pulse-outline"
        iconBg={`hsl(${theme.colors.tradeBuy} / 0.12)`}
        iconColor={`hsl(${theme.colors.tradeBuy})`}
        showBalances={showBalances}
      />
      <EquityCard
        label="UNREALIZED P&L"
        usd={unrealizedPnl}
        icon="trending-up-outline"
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
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  amount: { fontSize: 28, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pnlChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
});
