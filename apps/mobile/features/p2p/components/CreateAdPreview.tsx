import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { TerminalPanel } from '@shared/ui';
import type { CreateAdDraft } from '@core/domain/p2p/createAd';
import { formatFiatSymbol, formatP2pFiatPrice } from '@core/domain/p2p/marketplace';
import { resolveAdDisplayPrice } from '@core/domain/p2p/createAd';

type Props = {
  draft: CreateAdDraft;
  referencePrice: number | null;
  paymentMethodCount: number;
};

export function CreateAdPreview({ draft, referencePrice, paymentMethodCount }: Props) {
  const { theme } = useTheme();
  const fiat = draft.fiat ?? 'INR';
  const crypto = draft.currency ?? 'USDT';
  const sym = formatFiatSymbol(fiat);
  const display = resolveAdDisplayPrice(draft, referencePrice);
  const side = draft.type ?? 'sell';
  const sideColor = side === 'sell' ? '#f6465d' : '#0ecb81';

  return (
    <TerminalPanel style={styles.panel}>
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Live Preview</Text>
      <View style={styles.row}>
        <View>
          <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
            {crypto}/{fiat}
          </Text>
          <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})`, textTransform: 'capitalize' }}>
            {side} ad
          </Text>
        </View>
        <View style={[styles.badge, { backgroundColor: `${sideColor}18` }]}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: sideColor, textTransform: 'capitalize' }}>{side}</Text>
        </View>
      </View>
      <PreviewRow label="Price" value={display != null ? `${sym}${formatP2pFiatPrice(String(display), fiat)}` : '—'} theme={theme} />
      <PreviewRow
        label="Limits"
        value={`${draft.min_amount || '—'} – ${draft.max_amount || '—'} ${fiat}`}
        theme={theme}
      />
      <PreviewRow label="Available" value={`${draft.available_amount || '—'} ${crypto}`} theme={theme} />
      <PreviewRow label="Methods" value={`${paymentMethodCount} selected`} theme={theme} />
      <PreviewRow label="Window" value={`${draft.payment_time_limit ?? 15} min`} theme={theme} />
    </TerminalPanel>
  );
}

function PreviewRow({
  label,
  value,
  theme,
}: {
  label: string;
  value: string;
  theme: ReturnType<typeof useTheme>['theme'];
}) {
  return (
    <View style={styles.previewRow}>
      <Text style={{ fontSize: 12, color: `hsl(${theme.colors.foregroundSecondary})` }}>{label}</Text>
      <Text style={{ fontSize: 12, fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})` }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginBottom: 12 },
  title: { fontWeight: '700', marginBottom: 10, fontSize: 14 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  previewRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
});
