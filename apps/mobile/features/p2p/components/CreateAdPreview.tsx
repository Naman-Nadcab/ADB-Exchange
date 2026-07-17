import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
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
  const sidePalette = semanticStatusPalette(theme.colors, side === 'sell' ? 'sell' : 'buy');

  return (
    <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
      <Text
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[2.5] },
        ]}
      >
        Live Preview
      </Text>
      <View style={[styles.row, { marginBottom: theme.spacing[2.5] }]}>
        <View>
          <Text
            style={[
              theme.typography.bodyMd,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold },
            ]}
          >
            {crypto}/{fiat}
          </Text>
          <Text
            style={[
              theme.typography.bodySm,
              { color: `hsl(${theme.colors.foregroundSecondary})`, textTransform: 'capitalize' },
            ]}
          >
            {side} ad
          </Text>
        </View>
        <View
          style={[
            styles.badge,
            {
              borderRadius: theme.radius.md,
              paddingHorizontal: theme.spacing[2],
              paddingVertical: theme.spacing[1],
              backgroundColor: sidePalette.bg,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              { color: sidePalette.fg, fontFamily: theme.fonts.sansBold, textTransform: 'capitalize' },
            ]}
          >
            {side}
          </Text>
        </View>
      </View>
      <PreviewRow label="Price" value={display != null ? `${sym}${formatP2pFiatPrice(String(display), fiat)}` : '—'} />
      <PreviewRow label="Limits" value={`${draft.min_amount || '—'} – ${draft.max_amount || '—'} ${fiat}`} />
      <PreviewRow label="Available" value={`${draft.available_amount || '—'} ${crypto}`} />
      <PreviewRow label="Methods" value={`${paymentMethodCount} selected`} />
      <PreviewRow label="Window" value={`${draft.payment_time_limit ?? 15} min`} />
    </TerminalPanel>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.previewRow, { paddingVertical: theme.spacing[1] }]}>
      <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <Text
        style={[
          theme.typography.bodySm,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: {},
  previewRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
