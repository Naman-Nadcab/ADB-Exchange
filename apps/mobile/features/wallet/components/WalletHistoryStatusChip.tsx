import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { walletHistoryStatusTone } from '@core/domain/wallet/walletHistory';

type Props = {
  label: string;
  status?: string;
  confirmations?: number;
  requiredConfirmations?: number;
};

export function WalletHistoryStatusChip({ label, status = '', confirmations, requiredConfirmations }: Props) {
  const { theme } = useTheme();
  const tone = walletHistoryStatusTone(status);
  const palette = getPalette(tone, theme.colors);
  const showConfirmations =
    (status.toLowerCase() === 'pending' || status.toLowerCase() === 'confirming') &&
    typeof confirmations === 'number' &&
    typeof requiredConfirmations === 'number';

  return (
    <View style={[styles.chip, { backgroundColor: palette.bg }]}>
      <Text style={{ color: palette.fg, fontSize: 10, fontWeight: '700' }}>
        {showConfirmations ? `${confirmations}/${requiredConfirmations}` : label}
      </Text>
    </View>
  );
}

function getPalette(tone: ReturnType<typeof walletHistoryStatusTone>, c: ReturnType<typeof useTheme>['theme']['colors']) {
  switch (tone) {
    case 'live':
      return { bg: `hsl(${c.tradeBuy} / 0.12)`, fg: `hsl(${c.tradeBuy})` };
    case 'warn':
      return { bg: `hsl(${c.statusWarning} / 0.12)`, fg: `hsl(${c.statusWarning})` };
    case 'off':
      return { bg: `hsl(${c.tradeSell} / 0.12)`, fg: `hsl(${c.tradeSell})` };
    default:
      return { bg: `hsl(${c.surfaceMuted})`, fg: `hsl(${c.foregroundSecondary})` };
  }
}

const styles = StyleSheet.create({
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
});
