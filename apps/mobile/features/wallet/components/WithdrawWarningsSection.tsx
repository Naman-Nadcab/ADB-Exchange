import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { needsMemoTag } from '@core/domain/wallet/deposit';

type Props = {
  symbol: string;
  chainName: string;
  minWithdrawal?: string;
  confirmations?: number;
  chainType?: string;
};

export function WithdrawWarningsSection({ symbol, chainName, minWithdrawal, confirmations, chainType }: Props) {
  const { theme } = useTheme();
  const memoRequired = needsMemoTag(symbol);
  const isEvm = (chainType ?? '').toLowerCase().includes('evm');

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>IMPORTANT</Text>

      <WarningRow
        icon="alert-circle-outline"
        color={theme.colors.tradeSell}
        title="Irreversible transfer"
        body="On-chain withdrawals cannot be reversed. Verify address, network, and memo before submitting."
      />

      <WarningRow
        icon="alert-circle-outline"
        color={theme.colors.statusWarning}
        title="Wrong network warning"
        body={`Only withdraw ${symbol} on ${chainName}. Wrong network transfers may result in permanent loss.`}
      />

      {minWithdrawal ? (
        <WarningRow
          icon="information-circle-outline"
          color={theme.colors.statusInfo}
          title="Minimum withdrawal"
          body={`Minimum withdrawal is ${minWithdrawal} ${symbol}. Amounts below minimum may fail.`}
        />
      ) : null}

      {confirmations != null ? (
        <WarningRow
          icon="time-outline"
          color={theme.colors.foregroundSecondary}
          title="Processing time"
          body={`Withdrawals require ${confirmations} network confirmations before completion.`}
        />
      ) : null}

      {isEvm ? (
        <WarningRow
          icon="code-slash-outline"
          color={theme.colors.statusWarning}
          title="Smart contract addresses"
          body="Do not withdraw to a smart contract unless you are certain it accepts this token on this network."
        />
      ) : null}

      {memoRequired ? (
        <WarningRow
          icon="alert-circle"
          color={theme.colors.tradeSell}
          title="Memo / Tag required"
          body={`${symbol} withdrawals require the correct memo or destination tag. Missing memo may cause loss of funds.`}
        />
      ) : null}

      <WarningRow
        icon="help-circle-outline"
        color={theme.colors.foregroundSecondary}
        title="Recovery disclaimer"
        body="Incorrect withdrawals may require a paid recovery process and are not guaranteed."
      />
    </ExchangeCard>
  );
}

function WarningRow({
  icon,
  color,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, { borderTopColor: `hsl(${theme.colors.borderDefault})` }]}>
      <Ionicons name={icon} size={18} color={`hsl(${color})`} style={styles.icon} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600', fontSize: 13 }}>{title}</Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12, marginTop: 2 }}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
  icon: { marginTop: 2 },
});
