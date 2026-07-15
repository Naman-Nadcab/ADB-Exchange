import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { formatInr } from '@core/domain/wallet/fiat';
import { maskBalance } from '@core/domain/wallet/portfolio';

type Props = {
  availableBalance: string;
  isLoading: boolean;
  isError: boolean;
  showBalances: boolean;
  onRetry: () => void;
  onWithdrawInr: () => void;
  onManageBanks: () => void;
};

export function FiatBalanceCard({
  availableBalance,
  isLoading,
  isError,
  showBalances,
  onRetry,
  onWithdrawInr,
  onManageBanks,
}: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const display = isLoading ? '—' : mask(formatInr(availableBalance));

  return (
    <ExchangeCard elevated style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: 'hsl(142 76% 36% / 0.12)' }]}>
          <Ionicons name="cash-outline" size={22} color="hsl(142 76% 36%)" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>INR balance</Text>
          <Text style={[styles.amount, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{display}</Text>
          <Text style={[styles.note, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Fiat ledger is separate from crypto. INR is credited after bank transfer verification (admin) or via P2P
            sell — self-serve INR deposit is not live yet.
          </Text>
        </View>
      </View>
      {isError ? <ErrorBanner message="Could not load INR balance" onRetry={onRetry} /> : null}
      <View style={styles.actions}>
        <PrimaryButton title="Withdraw INR" onPress={onWithdrawInr} style={styles.primaryBtn} />
        <Pressable
          onPress={onManageBanks}
          style={[styles.secondaryBtn, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
        >
          <Ionicons name="business-outline" size={16} color={`hsl(${theme.colors.foregroundPrimary})`} />
          <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>
            Bank accounts
          </Text>
        </Pressable>
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: 14 },
  headerRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase' },
  amount: { fontSize: 24, fontWeight: '700', marginTop: 4, fontVariant: ['tabular-nums'] },
  note: { fontSize: 11, lineHeight: 16, marginTop: 6 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  primaryBtn: { flexGrow: 1, minWidth: 140 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
});
