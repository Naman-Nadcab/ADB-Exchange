import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ExchangeCard, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { semanticStatusPalette } from '@shared/theme/statusPalettes';
import { formatInr } from '@core/domain/wallet/fiat';
import { maskBalance } from '@core/domain/wallet/portfolio';

type Props = {
  availableBalance: string;
  isLoading: boolean;
  isError: boolean;
  showBalances: boolean;
  onRetry: () => void;
  onWithdrawInr: () => void;
  onManageBanks: () => void;
  onCryptoDeposit: () => void;
};

export function FiatBalanceCard({
  availableBalance,
  isLoading,
  isError,
  showBalances,
  onRetry,
  onWithdrawInr,
  onManageBanks,
  onCryptoDeposit,
}: Props) {
  const { theme } = useTheme();
  const success = semanticStatusPalette(theme.colors, 'success');
  const mask = (v: string) => maskBalance(v, showBalances);
  const display = isLoading ? '—' : mask(formatInr(availableBalance));

  return (
    <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5] }}>
      <View style={[styles.headerRow, { gap: theme.spacing[3] }]}>
        <View
          style={[
            styles.iconWrap,
            {
              width: theme.sizes.tapTarget,
              height: theme.sizes.tapTarget,
              borderRadius: theme.radius.lg,
              backgroundColor: success.bg,
            },
          ]}
        >
          <Ionicons name="cash-outline" size={theme.sizes.iconMd} color={success.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={[
              theme.typography.labelSm,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                fontFamily: theme.fonts.sansBold,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
              },
            ]}
          >
            INR balance
          </Text>
          <Text
            style={[
              theme.typography.displayMd,
              {
                color: `hsl(${theme.colors.foregroundPrimary})`,
                fontFamily: theme.fonts.sansBold,
                marginTop: theme.spacing[1],
                fontVariant: ['tabular-nums'],
              },
            ]}
          >
            {display}
          </Text>
          <Text
            style={[
              theme.typography.labelMd,
              {
                color: `hsl(${theme.colors.foregroundSecondary})`,
                marginTop: theme.spacing[1.5],
                lineHeight: 16,
              },
            ]}
          >
            Fiat ledger is separate from crypto. INR is credited after bank transfer verification (admin) or via P2P
            sell — self-serve INR deposit is not live yet.
          </Text>
        </View>
      </View>
      {isError ? <ErrorBanner message="Could not load INR balance" onRetry={onRetry} /> : null}
      <View style={[styles.actions, { gap: theme.spacing[2], marginTop: theme.spacing[3.5] }]}>
        <PrimaryButton title="Withdraw INR" onPress={onWithdrawInr} style={styles.primaryBtn} />
        <Pressable
          onPress={onManageBanks}
          style={[
            styles.secondaryBtn,
            {
              gap: theme.spacing[1.5],
              paddingHorizontal: theme.spacing[3.5],
              paddingVertical: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
            },
          ]}
        >
          <Ionicons name="business-outline" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundPrimary)} />
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Bank accounts
          </Text>
        </Pressable>
        <Pressable
          onPress={onCryptoDeposit}
          style={[
            styles.secondaryBtn,
            {
              gap: theme.spacing[1.5],
              paddingHorizontal: theme.spacing[3.5],
              paddingVertical: theme.spacing[3],
              borderRadius: theme.radius.md + 2,
              borderColor: hsl(theme.colors.borderDefault),
              minHeight: theme.sizes.tapTarget,
            },
          ]}
        >
          <Ionicons name="download-outline" size={theme.sizes.iconSm} color={hsl(theme.colors.foregroundPrimary)} />
          <Text
            style={[
              theme.typography.bodyMd,
              { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansSemiBold },
            ]}
          >
            Crypto deposit
          </Text>
        </Pressable>
      </View>
    </ExchangeCard>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  iconWrap: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap' },
  primaryBtn: { flexGrow: 1, minWidth: 140 },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});
