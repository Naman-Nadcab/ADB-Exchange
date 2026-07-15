import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import { PercentageSlider } from '@shared/ui/trading/PercentageSlider';
import type { WithdrawPreview } from '@exchange/mobile-types';

type Props = {
  preview?: WithdrawPreview;
  available?: string;
  symbol: string;
  isLoading?: boolean;
  onMax?: () => void;
  percent?: number;
  onPercentChange?: (pct: number) => void;
};

/** Displays backend preview values only — no client fee math. */
export function FeePreviewCard({
  preview,
  available,
  symbol,
  isLoading,
  onMax,
  percent,
  onPercentChange,
}: Props) {
  const { theme } = useTheme();

  if (isLoading) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})` }}>Loading fee preview…</Text>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>AMOUNT PREVIEW</Text>
        {onMax ? (
          <Pressable onPress={onMax} hitSlop={8}>
            <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700', fontSize: 12 }}>MAX</Text>
          </Pressable>
        ) : null}
      </View>
      <Row label="Available" value={`${available ?? '0'} ${symbol}`} theme={theme} />
      {preview ? (
        <>
          <Row label="Network fee" value={`${preview.fee} ${symbol}`} theme={theme} />
          <Row label="You receive" value={`${preview.net_amount} ${symbol}`} theme={theme} highlight />
          <Row label="Min withdrawal" value={`${preview.min_withdrawal} ${symbol}`} theme={theme} />
          {preview.fee_exceeds_amount ? (
            <Text style={{ color: `hsl(${theme.colors.statusError})`, marginTop: 8, fontSize: 12 }}>
              Fee exceeds amount — increase withdrawal amount.
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
          Enter an amount to preview fee and net receive.
        </Text>
      )}
      {onPercentChange != null && percent != null ? (
        <PercentageSlider value={percent} onChange={onPercentChange} />
      ) : null}
    </ExchangeCard>
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
  wrap: { marginBottom: 14 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
