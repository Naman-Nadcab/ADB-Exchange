import { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
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

  useEffect(() => {
    analytics.screen('S-541');
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

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

  const onRefresh = useCallback(() => {}, []);

  if (success) {
    return (
      <ScreenLayout testID="S-541-success">
        <View style={[styles.successBox, { backgroundColor: `hsl(${theme.colors.tradeBuy} / 0.12)` }]}>
          <Ionicons name="checkmark-circle" size={32} color={`hsl(${theme.colors.tradeBuy})`} />
          <Text style={{ color: `hsl(${theme.colors.tradeBuy})`, fontWeight: '700', fontSize: 16, marginTop: 8 }}>
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
          <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginBottom: 12, textAlign: 'center' }}>
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

        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, marginBottom: 12 }}>
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
  successBox: { alignItems: 'center', padding: 24, borderRadius: 16, marginBottom: 20, marginTop: 20 },
});
