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
    <TerminalPanel style={{ marginBottom: theme.spacing[3] }}>
      <Text
        style={[
          theme.typography.bodyMd,
          { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[2.5] },
        ]}
      >
        Market Insights
      </Text>
      <View style={[styles.grid, { gap: theme.spacing[2.5] }]}>
        <View
          style={[
            styles.cell,
            {
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
            },
          ]}
        >
          <Text style={[theme.typography.labelSm, styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Market Price
          </Text>
          <Text
            style={[
              theme.typography.headingSm,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginTop: theme.spacing[1] },
            ]}
          >
            {formatReferencePriceDisplay(fiat, referencePrice)}
          </Text>
        </View>
        <View
          style={[
            styles.cell,
            {
              borderRadius: theme.radius.md,
              padding: theme.spacing[2.5],
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
            },
          ]}
        >
          <Text style={[theme.typography.labelSm, styles.cellLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Your Price
          </Text>
          <Text
            style={[
              theme.typography.headingSm,
              { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansBold, marginTop: theme.spacing[1] },
            ]}
          >
            {display != null ? `${sym}${formatP2pFiatPrice(String(display), fiat)}` : '—'}
          </Text>
        </View>
      </View>
      {premium ? (
        <Text
          style={[
            theme.typography.bodySm,
            { marginTop: theme.spacing[2], color: `hsl(${theme.colors.foregroundSecondary})` },
          ]}
        >
          {premium}
        </Text>
      ) : null}
    </TerminalPanel>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row' },
  cell: { flex: 1 },
  cellLabel: { textTransform: 'uppercase' },
});
