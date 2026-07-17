import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { formatUsd, maskBalance, type TopHolding } from '@core/domain/wallet/portfolio';

type Props = {
  variant: 'funding' | 'trading';
  totalUsd: string;
  showBalances: boolean;
  holdings: TopHolding[];
  onPress?: () => void;
};

export function WalletAccountCard({ variant, totalUsd, showBalances, holdings, onPress }: Props) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);
  const isFunding = variant === 'funding';

  const content = (
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[2.5] }}>
      <View style={[styles.header, { gap: theme.spacing[2.5] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              width: theme.sizes.buttonMd,
              height: theme.sizes.buttonMd,
              borderRadius: theme.radius.md + 2,
              backgroundColor: isFunding
                ? `hsl(${theme.colors.brandPrimary} / 0.12)`
                : `hsl(${theme.colors.statusWarning} / 0.12)`,
            },
          ]}
        >
          <Ionicons
            name={isFunding ? 'wallet-outline' : 'bar-chart-outline'}
            size={theme.sizes.iconSm}
            color={isFunding ? hsl(theme.colors.brandPrimary) : hsl(theme.colors.statusWarning)}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.bodyLg,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold },
            ]}
          >
            {isFunding ? 'Funding Account' : 'Spot / Trading Account'}
          </Text>
          <Text style={[theme.typography.labelMd, { color: hsl(theme.colors.foregroundSecondary) }]}>
            {isFunding ? 'Deposits, P2P payouts, withdrawals' : 'Used for spot trading orders'}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text
            style={[
              theme.typography.headingMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold, fontVariant: ['tabular-nums'] },
            ]}
          >
            ${mask(formatUsd(totalUsd))}
          </Text>
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>USD</Text>
        </View>
      </View>

      {holdings.length > 0 ? (
        <View
          style={[
            styles.holdingsBox,
            {
              marginTop: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              padding: theme.spacing[2.5],
              backgroundColor: `hsl(${theme.colors.surfaceMuted} / 0.35)`,
            },
          ]}
        >
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: hsl(theme.colors.foregroundSecondary),
                fontFamily: theme.fonts.sansBold,
                letterSpacing: 1,
                marginBottom: theme.spacing[2],
              },
            ]}
          >
            TOP HOLDINGS
          </Text>
          {holdings.map((h) => (
            <View key={h.symbol} style={[styles.holdingRow, { gap: theme.spacing[2], marginBottom: theme.spacing[1.5] }]}>
              <Text style={[theme.typography.bodyMd, { fontFamily: theme.fonts.sansBold, color: hsl(theme.colors.foregroundPrimary) }]}>
                {h.symbol}
              </Text>
              <Text style={[theme.typography.bodySm, { color: hsl(theme.colors.foregroundSecondary) }]}>{mask(h.amount)}</Text>
              <Text
                style={[
                  theme.typography.bodySm,
                  { color: hsl(theme.colors.foregroundSecondary), minWidth: 72, textAlign: 'right' },
                ]}
              >
                ${mask(formatUsd(h.usd))}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </ExchangeCard>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  holdingsBox: {},
  holdingRow: { flexDirection: 'row', alignItems: 'center' },
});
