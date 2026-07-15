import { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, RefreshControl, Pressable, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '@shared/theme';
import {
  ScreenLayout,
  TextField,
  PrimaryButton,
  ErrorBanner,
  ErrorState,
} from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { validateTransferAmount } from '@core/domain/wallet/portfolio';
import {
  validateSameAccount,
  applyTransferPercent,
} from '@core/domain/wallet/transfer';
import { useAppStore } from '@core/state/appStore';
import { useWalletPrefsStore } from '@core/state/walletPrefsStore';
import type { AccountType } from '@exchange/mobile-types';
import { useTransferBalances, useRecentTransfers } from '../hooks/useWallet';
import { TransferFlowHeader } from '../components/TransferFlowHeader';
import { TransferAccountSection } from '../components/TransferAccountSection';
import { TransferCoinPicker } from '../components/TransferCoinPicker';
import { TransferAmountControls } from '../components/TransferAmountSection';
import { TransferPreviewCard } from '../components/TransferPreviewCard';
import { TransferInfoCard } from '../components/TransferInfoCard';
import { TransferRecentPreview } from '../components/TransferRecentPreview';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'Transfer'>;

export function TransferScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const [fromAccount, setFromAccount] = useState<AccountType>(route.params?.from ?? 'funding');
  const [toAccount, setToAccount] = useState<AccountType>(route.params?.to ?? 'trading');
  const [tokenId, setTokenId] = useState('');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(0);
  const [search, setSearch] = useState('');
  const [hideZero, setHideZero] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOnline = useAppStore((s) => s.isOnline);
  const favorites = useWalletPrefsStore((s) => s.favorites);

  const balancesQ = useTransferBalances(fromAccount);
  const recentQ = useRecentTransfers(10);

  useEffect(() => {
    analytics.screen('S-530');
  }, []);

  useEffect(() => {
    if (!balancesQ.data?.length) return;
    const sym = route.params?.symbol?.toUpperCase();
    if (sym) {
      const match = balancesQ.data.find((t) => t.symbol.toUpperCase() === sym);
      if (match) {
        setTokenId(match.tokenId);
        return;
      }
    }
    if (!tokenId) setTokenId(balancesQ.data[0].tokenId);
  }, [balancesQ.data, tokenId, route.params?.symbol]);

  const selected = useMemo(
    () => balancesQ.data?.find((t) => t.tokenId === tokenId),
    [balancesQ.data, tokenId],
  );

  const onRefresh = useCallback(() => {
    void balancesQ.refetch();
    void recentQ.refetch();
  }, [balancesQ, recentQ]);

  const swapDirection = () => {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
    setTokenId('');
    setAmount('');
    setPercent(0);
    setError(null);
  };

  const applyMax = () => {
    if (selected) {
      setAmount(selected.availableBalance);
      setPercent(100);
    }
  };

  const onPercent = (pct: number) => {
    setPercent(pct);
    if (selected) setAmount(applyTransferPercent(selected.availableBalance, pct));
  };

  const onFromChange = (a: AccountType) => {
    setFromAccount(a);
    setTokenId('');
    setAmount('');
    setPercent(0);
  };

  const proceed = () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot transfer until reconnected');
      return;
    }
    const sameErr = validateSameAccount(fromAccount, toAccount);
    if (sameErr) {
      setError(sameErr);
      return;
    }
    if (!tokenId || !selected) {
      setError('Please select a coin');
      return;
    }
    const v = validateTransferAmount(amount, selected.availableBalance);
    if (v) {
      setError(v);
      return;
    }
    navigation.navigate('TransferConfirm', {
      fromAccount,
      toAccount,
      tokenId,
      symbol: selected.symbol,
      name: selected.name,
      amount,
      available: selected.availableBalance,
    });
  };

  return (
    <ScreenLayout testID="S-530">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={balancesQ.isFetching} onRefresh={onRefresh} />}
      >
        <TransferFlowHeader step="Step 1 · Choose accounts, coin & amount" />

        <Pressable onPress={() => navigation.navigate('TransferHistory')} style={styles.historyLink}>
          <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600' }}>Transfer history</Text>
        </Pressable>

        {!isOnline ? <ErrorBanner message="Offline — balances may be stale" onRetry={onRefresh} /> : null}

        <TransferAccountSection
          fromAccount={fromAccount}
          toAccount={toAccount}
          onFromChange={onFromChange}
          onToChange={setToAccount}
          onSwap={swapDirection}
        />

        <TransferCoinPicker
          tokens={balancesQ.data ?? []}
          selectedId={tokenId}
          onSelect={(t) => {
            setTokenId(t.tokenId);
            setAmount('');
            setPercent(0);
          }}
          search={search}
          onSearchChange={setSearch}
          hideZero={hideZero}
          onHideZeroChange={setHideZero}
          favorites={favorites}
          isLoading={balancesQ.isLoading}
          isError={balancesQ.isError}
          onRetry={onRefresh}
        />

        {selected ? (
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
              symbol={selected.symbol}
              available={selected.availableBalance}
              amount={amount}
              onMax={applyMax}
              percent={percent}
              onPercentChange={onPercent}
            />
            <TransferPreviewCard
              fromAccount={fromAccount}
              toAccount={toAccount}
              symbol={selected.symbol}
              amount={amount}
            />
          </>
        ) : balancesQ.isError ? (
          <ErrorState title="Balances unavailable" onRetry={onRefresh} />
        ) : null}

        {error ? <ErrorBanner message={error} /> : null}

        <PrimaryButton title="Review Transfer" onPress={proceed} disabled={!selected || !amount} />

        <TransferInfoCard />

        <TransferRecentPreview
          items={recentQ.data ?? []}
          isLoading={recentQ.isLoading}
          error={recentQ.isError}
          onRetry={() => void recentQ.refetch()}
          onViewAll={() => navigation.navigate('TransferHistory')}
        />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  historyLink: { marginBottom: 12 },
});
