import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import {
  formatCreateAdPremiumLabel,
  formatReferencePriceDisplay,
  resolveAdDisplayPrice,
} from '@core/domain/p2p/createAd';
import type { CreateAdDraft } from '@core/domain/p2p/createAd';
import { formatFiatSymbol, formatP2pFiatPrice } from '@core/domain/p2p/marketplace';

type Props = {
  draft: CreateAdDraft;
  referencePrice: number | null;
};

export function CreateAdMarketInsights({ draft, referencePrice }: Props) {
  const { theme } = useTheme();
  const fiat = draft.fiat ?? 'INR';
  const sym = formatFiatSymbol(fiat);
  const display = resolveAdDisplayPrice(draft, referencePrice);
  const premium = formatCreateAdPremiumLabel(draft, referencePrice);

  return (
    <TerminalPanel style={styles.panel}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Market Insights</Text>
      <View style={styles.grid}>
        <View style={[styles.cell, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
          <Text style={styles.cellLabel}>Market Price</Text>
          <Text style={[styles.cellValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {formatReferencePriceDisplay(fiat, referencePrice)}
          </Text>
        </View>
        <View style={[styles.cell, { backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)` }]}>
          <Text style={styles.cellLabel}>Your Price</Text>
          <Text style={[styles.cellValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            {display != null ? `${sym}${formatP2pFiatPrice(String(display), fiat)}` : '—'}
          </Text>
        </View>
      </View>
      {premium ? (
        <Text style={{ marginTop: 8, fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>{premium}</Text>
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  panel: { marginBottom: 12 },
  title: { fontWeight: '700', marginBottom: 10, fontSize: 14 },
  grid: { flexDirection: 'row', gap: 10 },
  cell: { flex: 1, borderRadius: 10, padding: 10 },
  cellLabel: { fontSize: 10, fontWeight: '600', textTransform: 'uppercase', color: '#888' },
  cellValue: { fontSize: 15, fontWeight: '700', marginTop: 4 },
});
