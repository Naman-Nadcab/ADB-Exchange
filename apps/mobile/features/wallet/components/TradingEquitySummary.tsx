import type { ReactNode } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { formatUsd, maskBalance } from '@core/domain/wallet/portfolio';
import type { EquityTotal } from '@exchange/mobile-types';

type CardProps = {
  label: string;
  usd: EquityTotal;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  showBalances: boolean;
  trailing?: ReactNode;
};

function EquityCard({ label, usd, icon, iconBg, iconColor, showBalances, trailing }: CardProps) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <ExchangeCard elevated style={{ padding: theme.spacing[3.5] }}>
      <View style={[styles.header, { gap: theme.spacing[2.5], marginBottom: theme.spacing[2.5] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              width: theme.sizes.buttonMd,
              height: theme.sizes.buttonMd,
              borderRadius: theme.radius.md + 2,
              backgroundColor: iconBg,
            },
          ]}
        >
          <Ionicons name={icon} size={theme.sizes.iconSm} color={iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={[styles.labelRow, { gap: theme.spacing[2] }]}>
            <Text
              style={[
                theme.typography.labelSm,
                {
                  color: hsl(theme.colors.foregroundSecondary),
                  fontFamily: theme.fonts.sansBold,
                  letterSpacing: 1,
                },
              ]}
            >
              {label}
            </Text>
            {trailing}
          </View>
        </View>
      </View>
      <Text
        style={[
          theme.typography.displayMd,
          {
            color: hsl(theme.colors.foregroundPrimary),
            fontFamily: theme.fonts.sansBold,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        ${mask(formatUsd(usd.usd))}
      </Text>
      <Text
        style={[
          theme.typography.bodySm,
          { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[1] },
        ]}
      >
        USD
      </Text>
    </ExchangeCard>
  );
}

type Props = {
  totalEquity: EquityTotal;
  availableBalance: EquityTotal;
  unrealizedPnl: EquityTotal;
  showBalances: boolean;
  onOpenPnl?: () => void;
};

export function TradingEquitySummary({
  totalEquity,
  availableBalance,
  unrealizedPnl,
  showBalances,
  onOpenPnl,
}: Props) {
  const { theme } = useTheme();
  const warning = semanticStatusPalette(theme.colors, 'warning');

  return (
    <View style={{ gap: theme.spacing[2.5], marginBottom: theme.spacing[3.5] }}>
      <EquityCard
        label="TOTAL EQUITY"
        usd={totalEquity}
        icon="wallet-outline"
        iconBg={`hsl(${theme.colors.brandPrimary} / 0.12)`}
        iconColor={hsl(theme.colors.brandPrimary)}
        showBalances={showBalances}
        trailing={
          onOpenPnl ? (
            <Pressable
              onPress={onOpenPnl}
              style={[
                styles.pnlChip,
                {
                  gap: theme.spacing[1],
                  paddingHorizontal: theme.spacing[2],
                  paddingVertical: theme.spacing[1],
                  borderRadius: theme.radius.md,
                  backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)`,
                },
              ]}
            >
              <Ionicons name="trending-up-outline" size={theme.sizes.iconXs - 4} color={hsl(theme.colors.brandPrimary)} />
              <Text
                style={[
                  theme.typography.labelSm,
                  { color: hsl(theme.colors.brandPrimary), fontFamily: theme.fonts.sansBold },
                ]}
              >
                P&L
              </Text>
            </Pressable>
          ) : null
        }
      />
      <EquityCard
        label="AVAILABLE BALANCE"
        usd={availableBalance}
        icon="pulse-outline"
        iconBg={`hsl(${theme.colors.tradeBuy} / 0.12)`}
        iconColor={hsl(theme.colors.tradeBuy)}
        showBalances={showBalances}
      />
      <EquityCard
        label="UNREALIZED P&L"
        usd={unrealizedPnl}
        icon="trending-up-outline"
        iconBg={warning.bg}
        iconColor={warning.fg}
        showBalances={showBalances}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  labelRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  pnlChip: { flexDirection: 'row', alignItems: 'center' },
});
