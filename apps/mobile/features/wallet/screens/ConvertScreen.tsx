import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, SegmentControl } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { useConvertCurrencies, useConvertQuote, useExecuteConvert } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'Convert'>;

export function ConvertScreen({ navigation }: Props) {
  const [fromSymbol, setFromSymbol] = useState('USDT');
  const [toSymbol, setToSymbol] = useState('BTC');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isOnline = useAppStore((s) => s.isOnline);

  const currenciesQ = useConvertCurrencies();
  const quoteQ = useConvertQuote(fromSymbol, toSymbol, amount || '1', !!amount);
  const convert = useExecuteConvert();

  useEffect(() => {
    analytics.screen('S-540');
  }, []);

  const fromCurrency = useMemo(
    () => currenciesQ.data?.find((c) => c.symbol === fromSymbol),
    [currenciesQ.data, fromSymbol],
  );
  const toCurrency = useMemo(
    () => currenciesQ.data?.find((c) => c.symbol === toSymbol),
    [currenciesQ.data, toSymbol],
  );

  const tabs = useMemo(
    () => (currenciesQ.data ?? []).slice(0, 12).map((c) => ({ id: c.symbol, label: c.symbol })),
    [currenciesQ.data],
  );

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!isOnline) {
      setError('Offline — cannot convert');
      return;
    }
    if (!fromCurrency?.id || !toCurrency?.id || !amount) {
      setError('Select currencies and amount');
      return;
    }
    try {
      await convert.mutateAsync({
        fromCurrencyId: fromCurrency.id,
        toCurrencyId: toCurrency.id,
        fromAmount: amount,
        accountType: 'funding',
      });
      setSuccess('Conversion completed');
      setAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Convert failed');
    }
  };

  return (
    <ScreenLayout testID="S-540">
      <Text style={styles.label}>From</Text>
      {tabs.length ? (
        <SegmentControl tabs={tabs} active={fromSymbol} onChange={setFromSymbol} />
      ) : null}
      <Text style={styles.label}>To</Text>
      {tabs.length ? (
        <SegmentControl tabs={tabs} active={toSymbol} onChange={setToSymbol} />
      ) : null}
      <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {quoteQ.data ? (
        <View style={styles.preview}>
          <Text style={styles.previewText}>
            Preview: {quoteQ.data.from.amount} {fromSymbol} → {quoteQ.data.to.amount} {toSymbol}
          </Text>
          <Text style={styles.previewSub}>Rate {quoteQ.data.rate} · expires {quoteQ.data.expiresIn}s</Text>
        </View>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <PrimaryButton title="Convert Now" loading={convert.isPending} onPress={() => void submit()} />
      <View style={styles.footer}>
        <PrimaryButton
          title="Convert History"
          variant="secondary"
          onPress={() => navigation.navigate('ConvertHistory')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  label: { fontWeight: '600', marginTop: 8, marginBottom: 4 },
  preview: { marginVertical: 12, padding: 12, borderRadius: 8, backgroundColor: '#f4f4f5' },
  previewText: { fontWeight: '600' },
  previewSub: { fontSize: 11, marginTop: 4, color: '#666' },
  success: { color: '#10B981', marginVertical: 8 },
  footer: { marginTop: 16 },
});
