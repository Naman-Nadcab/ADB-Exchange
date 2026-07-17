import { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, PrimaryButton, ErrorBanner, SkeletonList } from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { mapConvertApiError, formatQuoteCountdown } from '@core/domain/wallet/convert';
import { useExecuteConvert } from '../hooks/useWallet';
import { ConvertFlowHeader } from '../components/ConvertFlowHeader';
import { ConvertPreviewCard } from '../components/ConvertPreviewCard';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'ConvertConfirm'>;

export function ConvertConfirmScreen({ navigation, route }: Props) {
  const p = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const convert = useExecuteConvert();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(Date.now());

  const paramsValid =
    !!p?.quote?.fromCurrencyId &&
    !!p?.quote?.toCurrencyId &&
    !!p?.fromSymbol &&
    !!p?.toSymbol &&
    !!p?.amount;

  useEffect(() => {
    analytics.screen('S-541');
  }, []);

  useEffect(() => {
    if (!paramsValid) {
      navigation.replace('Convert');
    }
  }, [paramsValid, navigation]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = useCallback(() => {}, []);

  if (!paramsValid) {
    return (
      <ScreenLayout testID="S-541">
        <SkeletonList rows={4} />
      </ScreenLayout>
    );
  }

  const remainingMs = p.quote.expiresAtMs - nowTick;
  const quoteExpired = remainingMs <= 0;

  const submit = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot convert until reconnected');
      return;
    }
    if (quoteExpired) {
      setError('Quote expired. Go back and get a new quote.');
      return;
    }
    try {
      const res = await convert.mutateAsync({
        fromCurrencyId: p.quote.fromCurrencyId,
        toCurrencyId: p.quote.toCurrencyId,
        fromAmount: p.amount,
        accountType: p.accountType,
      });
      const got = res.to?.amount;
      const sym = res.to?.currency ?? p.toSymbol;
      setSuccess(got != null ? `Received ${got} ${sym}` : 'Conversion completed.');
    } catch (err) {
      setError(err instanceof ApiError ? mapConvertApiError(err.code, err.message) : 'Conversion failed');
    }
  };

  if (success) {
    return (
      <ScreenLayout testID="S-541-success">
        <View
          style={[
            styles.successBox,
            {
              backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.12)`,
              padding: theme.spacing[6],
              borderRadius: theme.radius.xl,
              marginBottom: theme.spacing[5],
              marginTop: theme.spacing[5],
            },
          ]}
        >
          <Ionicons name="checkmark-circle" size={theme.sizes.iconLg} color={hsl(theme.colors.tradeBuy)} />
          <Text
            style={[
              theme.typography.headingSm,
              {
                color: hsl(theme.colors.tradeBuy),
                fontFamily: theme.fonts.sansBold,
                marginTop: theme.spacing[2],
              },
            ]}
          >
            {success}
          </Text>
        </View>
        <PrimaryButton title="View Conversion History" onPress={() => navigation.replace('ConvertHistory')} />
        <PrimaryButton title="Swap again" variant="secondary" onPress={() => navigation.popToTop()} />
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout testID="S-541">
      <ScrollView refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}>
        <ConvertFlowHeader step="Step 2 · Confirm conversion" />
        {!isOnline ? <ErrorBanner message="Offline — cannot submit conversion" /> : null}

        {quoteExpired ? (
          <ErrorBanner message="Quote expired. Go back and refresh the quote." onRetry={() => navigation.goBack()} />
        ) : (
          <Text
            style={[
              theme.typography.bodySm,
              {
                color: hsl(theme.colors.statusWarning),
                marginBottom: theme.spacing[3],
                textAlign: 'center',
              },
            ]}
          >
            Quote expires in {formatQuoteCountdown(remainingMs)}
          </Text>
        )}

        <ConvertPreviewCard
          accountType={p.accountType}
          fromSymbol={p.fromSymbol}
          toSymbol={p.toSymbol}
          fromAmount={p.amount}
          toAmount={p.quote.toAmount}
          rate={p.quote.rate}
          fee={p.quote.fee}
        />

        <Text
          style={[
            theme.typography.labelSm,
            {
              color: hsl(theme.colors.foregroundSecondary),
              marginBottom: theme.spacing[3],
            },
          ]}
        >
          Account conversions do not require 2FA or fund password.
        </Text>

        {error ? <ErrorBanner message={error} onRetry={() => void submit()} /> : null}

        <PrimaryButton
          title={convert.isPending ? 'Converting…' : 'Confirm Conversion'}
          loading={convert.isPending}
          onPress={() => void submit()}
          disabled={quoteExpired}
        />
        <PrimaryButton title="Back" variant="secondary" onPress={() => navigation.goBack()} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  successBox: { alignItems: 'center' },
});
