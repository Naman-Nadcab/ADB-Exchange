import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import type { WithdrawPreview } from '@exchange/mobile-types';

type Props = {
  preview?: WithdrawPreview;
  available?: string;
  symbol: string;
  isLoading?: boolean;
};

/** Displays backend preview values only — no client fee math. */
export function FeePreviewCard({ preview, available, symbol, isLoading }: Props) {
  const { theme } = useTheme();

  if (isLoading) {
    return <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Loading fee preview…</Text>;
  }

  if (!preview) return null;

  return (
    <View style={styles.wrap}>
      <Row label="Available" value={`${available ?? '0'} ${symbol}`} theme={theme} />
      <Row label="Network fee" value={`${preview.fee} ${symbol}`} theme={theme} />
      <Row label="You receive" value={`${preview.net_amount} ${symbol}`} theme={theme} highlight />
      <Row label="Min withdrawal" value={`${preview.min_withdrawal} ${symbol}`} theme={theme} />
      {preview.fee_exceeds_amount ? (
        <Text style={{ color: `hsl(${theme.colors.statusError})`, marginTop: 8, fontSize: 12 }}>
          Fee exceeds amount — increase withdrawal amount.
        </Text>
      ) : null}
    </View>
  );
}

function Row({
  label,
  value,
  theme,
  highlight,
}: {
  label: string;
  value: string;
  theme: { colors: Record<string, string> };
  highlight?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary})`,
          fontWeight: highlight ? '700' : '600',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 12, borderRadius: 8, marginVertical: 8 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
