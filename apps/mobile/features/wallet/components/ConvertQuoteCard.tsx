import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@shared/theme';
import { ExchangeCard } from '@shared/ui';
import type { ConvertQuoteSnapshot } from '@exchange/mobile-types';
import {
  formatQuoteCountdown,
  computeSlippagePercent,
  formatRateDisplay,
} from '@core/domain/wallet/convert';

type Props = {
  quote: ConvertQuoteSnapshot | null;
  fromSymbol: string;
  toSymbol: string;
  fromAmount: string;
  onExpired?: () => void;
};

export function ConvertQuoteCard({ quote, fromSymbol, toSymbol, fromAmount, onExpired }: Props) {
  const { theme } = useTheme();
  const [nowTick, setNowTick] = useState(Date.now());

  useEffect(() => {
    if (!quote) return;
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [quote]);

  const remainingMs = quote ? quote.expiresAtMs - nowTick : 0;
  const isExpired = quote != null && remainingMs <= 0;

  useEffect(() => {
    if (isExpired) onExpired?.();
  }, [isExpired, onExpired]);

  if (!quote) return null;

  if (isExpired) {
    return (
      <ExchangeCard variant="terminal" style={styles.wrap}>
        <Text style={{ color: `hsl(${theme.colors.tradeSell})`, fontWeight: '600', textAlign: 'center', padding: 14 }}>
          Quote expired. Get a new quote to continue.
        </Text>
      </ExchangeCard>
    );
  }

  return (
    <ExchangeCard variant="terminal" style={styles.wrap}>
      <Row label="Rate" value={formatRateDisplay(fromSymbol, toSymbol, quote.rate)} theme={theme} first />
      <Row
        label="Estimated output"
        value={`${parseFloat(quote.toAmount).toLocaleString(undefined, { maximumFractionDigits: 8 })} ${toSymbol}`}
        theme={theme}
      />
      <Row label="Slippage" value={computeSlippagePercent(fromAmount, quote.rate, quote.toAmount)} theme={theme} />
      <Row label="Fee" value={quote.fee === '0' ? 'Free' : quote.fee} theme={theme} highlight={quote.fee === '0'} />
      <View style={styles.timerRow}>
        <Ionicons name="time-outline" size={14} color={`hsl(${theme.colors.statusWarning})`} />
        <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontWeight: '600', fontSize: 12 }}>
          Expires in {formatQuoteCountdown(remainingMs)}
        </Text>
      </View>
    </ExchangeCard>
  );
}

function Row({
  label,
  value,
  theme,
  highlight,
  first,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
  highlight?: boolean;
  first?: boolean;
}) {
  return (
    <View
      style={[
        styles.row,
        !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: `hsl(${theme.colors.borderDefault})` } : null,
      ]}
    >
      <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>{label}</Text>
      <Text
        style={{
          color: `hsl(${highlight ? theme.colors.tradeBuy : theme.colors.foregroundPrimary})`,
          fontWeight: '600',
          fontSize: 12,
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14, paddingVertical: 0, paddingHorizontal: 0 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 14, paddingVertical: 10 },
  timerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12 },
});
