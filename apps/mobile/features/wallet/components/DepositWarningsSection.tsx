import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { needsMemoTag } from '@core/domain/wallet/deposit';

type Props = {
  symbol: string;
  chainName: string;
  minDeposit?: string;
  confirmations?: number;
  chainType?: string;
};

export function DepositWarningsSection({ symbol, chainName, minDeposit, confirmations, chainType }: Props) {
  const { theme } = useTheme();
  const memoRequired = needsMemoTag(symbol);
  const isEvm = (chainType ?? '').toLowerCase().includes('evm');

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>IMPORTANT</Text>

      {minDeposit ? (
        <WarningRow
          icon="information-circle-outline"
          color={theme.colors.statusInfo}
          title="Minimum deposit"
          body={`Deposits below ${minDeposit} ${symbol} may not be credited.`}
        />
      ) : null}

      <WarningRow
        icon="alert-circle-outline"
        color={theme.colors.statusWarning}
        title="Wrong network warning"
        body={`Only send ${symbol} on ${chainName}. Sending on an unsupported network may result in permanent loss.`}
      />

      <WarningRow
        icon="shield-outline"
        color={theme.colors.statusWarning}
        title="Unsupported network"
        body="Cross-chain deposits to this address are not supported. Verify the network before sending."
      />

      {confirmations != null ? (
        <WarningRow
          icon="time-outline"
          color={theme.colors.foregroundSecondary}
          title="Confirmations required"
          body={`${confirmations} network confirmations are required before your deposit is credited.`}
        />
      ) : null}

      {isEvm ? (
        <WarningRow
          icon="code-slash-outline"
          color={theme.colors.statusWarning}
          title="Smart contract warning"
          body="Do not send from a smart contract wallet unless this network supports contract deposits."
        />
      ) : null}

      {memoRequired ? (
        <WarningRow
          icon="alert-circle"
          color={theme.colors.tradeSell}
          title="Memo / Tag required"
          body={`${symbol} deposits require the correct memo or destination tag. Deposits without it may not be credited.`}
        />
      ) : null}

      <WarningRow
        icon="help-circle-outline"
        color={theme.colors.foregroundSecondary}
        title="Recovery disclaimer"
        body="Incorrect deposits may require a paid recovery process and are not guaranteed. Always double-check address, network, and memo."
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
