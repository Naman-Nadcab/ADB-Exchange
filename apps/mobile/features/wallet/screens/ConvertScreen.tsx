import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ScrollView, RefreshControl, Pressable, Text, StyleSheet, Animated, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  TextField,
  PrimaryButton,
  ErrorBanner,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import { ApiError } from '@core/api/errors/ApiError';
import type { AccountType, ConvertQuoteSnapshot } from '@exchange/mobile-types';
import {
  validateConvertPair,
  validateConvertAmount,
  applyConvertPercent,
  buildQuoteSnapshot,
  mapConvertApiError,
} from '@core/domain/wallet/convert';
import {
  useConvertCurrencies,
  useConvertBalances,
  useGetConvertQuote,
  useConvertDust,
  useRecentConversions,
} from '../hooks/useWallet';
import { ConvertFlowHeader } from '../components/ConvertFlowHeader';
import { ConvertAccountSection } from '../components/ConvertAccountSection';
import { ConvertAssetPicker } from '../components/ConvertAssetPicker';
import { TransferAmountControls } from '../components/TransferAmountSection';
import { ConvertQuoteCard } from '../components/ConvertQuoteCard';
import { ConvertDustCard } from '../components/ConvertDustCard';
import { ConvertRecentPreview } from '../components/ConvertRecentPreview';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'Convert'>;

export function ConvertScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const favorites = useWalletPrefsStore((s) => s.favorites);
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const [accountType, setAccountType] = useState<AccountType>(route.params?.accountType ?? 'spot');
  const [fromSymbol, setFromSymbol] = useState(route.params?.fromSymbol ?? 'BTC');
  const [toSymbol, setToSymbol] = useState(route.params?.toSymbol ?? 'USDT');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(0);
  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [quote, setQuote] = useState<ConvertQuoteSnapshot | null>(null);
  const [quoteExpired, setQuoteExpired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dustResult, setDustResult] = useState<{ count: number; totalUsdt: string } | null>(null);

  const currenciesQ = useConvertCurrencies();
  const balancesQ = useConvertBalances(accountType);
  const getQuote = useGetConvertQuote();
  const dust = useConvertDust();
  const recentQ = useRecentConversions(10);

  useEffect(() => {
    analytics.screen('S-540');
  }, []);

  const clearQuote = useCallback(() => {
    setQuote(null);
    setQuoteExpired(false);
  }, []);

  useEffect(() => {
    clearQuote();
  }, [accountType, fromSymbol, toSymbol, amount, clearQuote]);

  useEffect(() => {
    const list = currenciesQ.data ?? [];
    if (route.params?.fromSymbol) return;
    if (list.some((c) => c.symbol === 'BTC')) setFromSymbol('BTC');
    if (list.some((c) => c.symbol === 'USDT')) setToSymbol('USDT');
  }, [currenciesQ.data, route.params?.fromSymbol]);

  const fromCurrency = useMemo(
    () => currenciesQ.data?.find((c) => c.symbol === fromSymbol),
    [currenciesQ.data, fromSymbol],
  );
  const toCurrency = useMemo(
    () => currenciesQ.data?.find((c) => c.symbol === toSymbol),
    [currenciesQ.data, toSymbol],
  );
  const available = useMemo(() => {
    const bal = balancesQ.data?.find((b) => b.symbol.toUpperCase() === fromSymbol.toUpperCase());
    return bal?.available_balance ?? '0';
  }, [balancesQ.data, fromSymbol]);

  const locked = useMemo(() => {
    const bal = balancesQ.data?.find((b) => b.symbol.toUpperCase() === fromSymbol.toUpperCase());
    const total = parseFloat(bal?.total_balance ?? '0');
    const avail = parseFloat(bal?.available_balance ?? '0');
    return String(Math.max(0, total - avail));
  }, [balancesQ.data, fromSymbol]);

  const onRefresh = useCallback(() => {
    void currenciesQ.refetch();
    void balancesQ.refetch();
    void recentQ.refetch();
  }, [currenciesQ, balancesQ, recentQ]);

  const swapAssets = () => {
    Animated.sequence([
      Animated.timing(rotateAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(rotateAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
    ]).start();
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setAmount('');
    setPercent(0);
    clearQuote();
    setError(null);
  };

  const applyMax = () => {
    setAmount(available);
    setPercent(100);
  };

  const onPercent = (pct: number) => {
    setPercent(pct);
    setAmount(applyConvertPercent(available, pct));
  };

  const handleGetQuote = async () => {
    setError(null);
    clearQuote();
    const pairErr = validateConvertPair(fromSymbol, toSymbol);
    if (pairErr) {
      setError(pairErr);
      return;
    }
    const amtErr = validateConvertAmount(amount, available);
    if (amtErr) {
      setError(amtErr);
      return;
    }
    if (!isOnline) {
      setError('Offline — cannot get quote');
      return;
    }
    try {
      const res = await getQuote.mutateAsync({ from: fromSymbol, to: toSymbol, amount });
      const snapshot = buildQuoteSnapshot(res);
      if (!snapshot) {
        setError('Invalid quote response.');
        return;
      }
      setQuote(snapshot);
      setQuoteExpired(false);
    } catch (err) {
      setError(err instanceof ApiError ? mapConvertApiError(err.code, err.message) : 'Failed to get quote');
    }
  };

  const proceed = () => {
    setError(null);
    if (!quote || quoteExpired) {
      setError('Get a valid quote first.');
      return;
    }
    if (Date.now() >= quote.expiresAtMs) {
      setError('Quote expired. Get a new quote to continue.');
      return;
    }
    navigation.navigate('ConvertConfirm', {
      accountType,
      fromSymbol,
      toSymbol,
      fromName: fromCurrency?.name ?? fromSymbol,
      toName: toCurrency?.name ?? toSymbol,
      amount,
      available,
      quote,
    });
  };

  const handleDust = async () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot convert dust');
      return;
    }
    try {
      const res = await dust.mutateAsync(1);
      const count = res.assetsConverted ?? res.converted_count ?? 0;
      const total = res.totalUsdt ?? res.total_usdt_received ?? '0';
      setDustResult({ count, totalUsdt: total });
      void recentQ.refetch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Dust conversion failed');
    }
  };

  const spin = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <ScreenLayout testID="S-540">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={balancesQ.isFetching} onRefresh={onRefresh} />}
      >
        <ConvertFlowHeader step="Step 1 · Select assets, amount & quote" />

        <Pressable onPress={() => navigation.navigate('ConvertHistory')} style={styles.link}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Conversion history</Text>
        </Pressable>

        {!isOnline ? <ErrorBanner message="Offline — rates and balances may be stale" onRetry={onRefresh} /> : null}

        <ConvertDustCard onConvert={() => void handleDust()} isLoading={dust.isPending} result={dustResult} />

        <ConvertAccountSection
          accountType={accountType}
          onChange={(a) => {
            setAccountType(a);
            setAmount('');
            setPercent(0);
          }}
        />

        <ConvertAssetPicker
          label="FROM"
          subtitle={`Available: ${parseFloat(available).toFixed(6)} ${fromSymbol}${parseFloat(locked) > 0 ? ` · Locked: ${locked}` : ''}`}
          currencies={currenciesQ.data ?? []}
          balances={balancesQ.data}
          selectedSymbol={fromSymbol}
          onSelect={(sym) => {
            setFromSymbol(sym);
            setAmount('');
            setPercent(0);
          }}
          search={fromSearch}
          onSearchChange={setFromSearch}
          hideZero={hideZero}
          onHideZeroChange={setHideZero}
          favorites={favorites}
          showBalance
          isLoading={balancesQ.isLoading || currenciesQ.isLoading}
          isError={balancesQ.isError}
          onRetry={onRefresh}
        />

        <Pressable onPress={swapAssets} accessibilityLabel="Swap direction" style={[styles.swap, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
          <Animated.View style={{ transform: [{ rotate: spin }] }}>
            <Ionicons name="swap-vertical" size={22} color={`hsl(${theme.colors.brandPrimary})`} />
          </Animated.View>
        </Pressable>

        <ConvertAssetPicker
          label="TO (estimated)"
          subtitle={quote && !quoteExpired ? `Estimated: ${quote.toAmount} ${toSymbol}` : undefined}
          currencies={currenciesQ.data ?? []}
          selectedSymbol={toSymbol}
          onSelect={setToSymbol}
          search={toSearch}
          onSearchChange={setToSearch}
          favorites={favorites}
          isLoading={currenciesQ.isLoading}
          isError={currenciesQ.isError}
          onRetry={() => void currenciesQ.refetch()}
        />

        {fromCurrency ? (
          <>
            <TextField
              label="Amount"
              value={amount}
              onChangeText={(v) => {
                setAmount(v);
                setPercent(0);
              }}
              keyboardType="decimal-pad"
              placeholder="Enter amount"
            />
            <TransferAmountControls
              symbol={fromSymbol}
              available={available}
              amount={amount}
              onMax={applyMax}
              percent={percent}
              onPercentChange={onPercent}
            />
          </>
        ) : null}

        <PrimaryButton
          title={getQuote.isPending ? 'Getting quote…' : 'Get quote'}
          variant="secondary"
          loading={getQuote.isPending}
          onPress={() => void handleGetQuote()}
          disabled={!fromSymbol || !toSymbol || !amount}
        />

        <ConvertQuoteCard
          quote={quote}
          fromSymbol={fromSymbol}
          toSymbol={toSymbol}
          fromAmount={amount}
          onExpired={() => setQuoteExpired(true)}
        />

        {error ? <ErrorBanner message={error} /> : null}

        <PrimaryButton
          title="Review Conversion"
          onPress={proceed}
          disabled={!quote || quoteExpired || !amount}
        />

        <View style={styles.footerLinks}>
          <PrimaryButton title="Deposit" variant="secondary" onPress={() => navigation.navigate('DepositHome')} />
          <PrimaryButton title="Transfer" variant="secondary" onPress={() => navigation.navigate('Transfer')} />
        </View>

        <ConvertRecentPreview
          items={recentQ.data ?? []}
          isLoading={recentQ.isLoading}
          error={recentQ.isError}
          onRetry={() => void recentQ.refetch()}
          onViewAll={() => navigation.navigate('ConvertHistory')}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  link: { marginBottom: 12 },
  swap: { alignSelf: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginVertical: 8 },
  footerLinks: { flexDirection: 'row', gap: 8, marginVertical: 12 },
});
