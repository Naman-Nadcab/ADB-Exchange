import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { formatUsd, formatCryptoAmount, maskBalance } from '@core/domain/wallet/portfolio';
import type { EquityTotal } from '@exchange/mobile-types';

type CardProps = {
  label: string;
  subtitle: string;
  usd: EquityTotal;
  icon: keyof typeof Ionicons.glyphMap;
  iconBg: string;
  iconColor: string;
  showBalances: boolean;
};

function EquityCard({ label, subtitle, usd, icon, iconBg, iconColor, showBalances }: CardProps) {
  const { theme } = useTheme();
  const mask = (v: string) => maskBalance(v, showBalances);

  return (
    <ExchangeCard elevated>
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
        <View>
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
          <Text style={[theme.typography.labelSm, { color: hsl(theme.colors.foregroundSecondary) }]}>{subtitle}</Text>
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
      {usd.btc ? (
        <Text
          style={[
            theme.typography.bodySm,
            { color: hsl(theme.colors.foregroundSecondary), marginTop: theme.spacing[1] },
          ]}
        >
          ≈ {mask(formatCryptoAmount(usd.btc))} BTC
        </Text>
      ) : null}
    </ExchangeCard>
  );
}

type Props = {
  totalEquity: EquityTotal;
  availableBalance: EquityTotal;
  inUse: EquityTotal;
  showBalances: boolean;
};

export function FundingEquitySummary({ totalEquity, availableBalance, inUse, showBalances }: Props) {
  const { theme } = useTheme();
  const warning = `hsl(${theme.colors.statusWarning} / 0.12)`;

  return (
    <View style={{ gap: theme.spacing[2.5], marginBottom: theme.spacing[3.5] }}>
      <EquityCard
        label="TOTAL EQUITY"
        subtitle="Funding wallet (USD)"
        usd={totalEquity}
        icon="wallet-outline"
        iconBg={`hsl(${theme.colors.brandPrimary} / 0.12)`}
        iconColor={`hsl(${theme.colors.brandPrimary})`}
        showBalances={showBalances}
      />
      <EquityCard
        label="AVAILABLE"
        subtitle="Ready to trade or withdraw"
        usd={availableBalance}
        icon="arrow-up-outline"
        iconBg={`hsl(${theme.colors.tradeBuy} / 0.12)`}
        iconColor={`hsl(${theme.colors.tradeBuy})`}
        showBalances={showBalances}
      />
      <EquityCard
        label="IN USE"
        subtitle="Locked in orders or pending"
        usd={inUse}
        icon="time-outline"
        iconBg={warning}
        iconColor={`hsl(${theme.colors.statusWarning})`}
        showBalances={showBalances}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
});
