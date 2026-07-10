import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, SegmentControl, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { validateTransferAmount } from '@core/domain/wallet/portfolio';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import type { AccountType } from '@exchange/mobile-types';
import { useTransferBalances, useExecuteTransfer } from '../hooks/useWallet';
import type { WalletStackParamList } from '../navigation/types';

const ACCOUNTS: { id: AccountType; label: string }[] = [
  { id: 'funding', label: 'Funding' },
  { id: 'trading', label: 'Trading' },
];

type Props = NativeStackScreenProps<WalletStackParamList, 'Transfer'>;

export function TransferScreen({ navigation, route }: Props) {
  const [fromAccount, setFromAccount] = useState<AccountType>(route.params?.from ?? 'funding');
  const [toAccount, setToAccount] = useState<AccountType>(route.params?.to ?? 'trading');
  const [tokenId, setTokenId] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const isOnline = useAppStore((s) => s.isOnline);

  const balancesQ = useTransferBalances(fromAccount);
  const transfer = useExecuteTransfer();

  useEffect(() => {
    analytics.screen('S-530');
  }, []);

  useEffect(() => {
    if (balancesQ.data?.length && !tokenId) setTokenId(balancesQ.data[0].tokenId);
  }, [balancesQ.data, tokenId]);

  const selected = useMemo(
    () => balancesQ.data?.find((t) => t.tokenId === tokenId),
    [balancesQ.data, tokenId],
  );

  const swapDirection = () => {
    setFromAccount(toAccount);
    setToAccount(fromAccount);
    setTokenId('');
    setAmount('');
    setError(null);
  };

  const submit = async () => {
    setError(null);
    setSuccess(null);
    if (!isOnline) {
      setError('Offline — cannot transfer');
      return;
    }
    if (fromAccount === toAccount) {
      setError('Select different accounts');
      return;
    }
    if (!tokenId || !selected) {
      setError('Select an asset');
      return;
    }
    const v = validateTransferAmount(amount, selected.availableBalance);
    if (v) {
      setError(v);
      return;
    }
    try {
      await transfer.mutateAsync({ fromAccount, toAccount, tokenId, amount });
      setSuccess(`Transferred ${amount} ${selected.symbol} successfully`);
      setAmount('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Transfer failed');
    }
  };

  return (
    <ScreenLayout testID="S-530">
      <SegmentControl
        tabs={ACCOUNTS}
        active={fromAccount}
        onChange={(id) => {
          setFromAccount(id as AccountType);
          setTokenId('');
        }}
      />
      <Text style={styles.arrow}>↓</Text>
      <SegmentControl
        tabs={ACCOUNTS}
        active={toAccount}
        onChange={(id) => setToAccount(id as AccountType)}
      />
      <PrimaryButton title="Swap direction" variant="secondary" onPress={swapDirection} />
      {balancesQ.data?.length ? (
        <SegmentControl
          tabs={balancesQ.data.map((t) => ({ id: t.tokenId, label: t.symbol }))}
          active={tokenId}
          onChange={setTokenId}
        />
      ) : null}
      <Text style={styles.avail}>
        Available: {selected?.availableBalance ?? '0'} {selected?.symbol ?? ''}
      </Text>
      <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      {error ? <ErrorBanner message={error} /> : null}
      {success ? <Text style={styles.success}>{success}</Text> : null}
      <PrimaryButton title="Confirm Transfer" loading={transfer.isPending} onPress={() => void submit()} />
      <View style={styles.footer}>
        <PrimaryButton
          title="Transfer History"
          variant="secondary"
          onPress={() => navigation.navigate('TransferHistory')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  arrow: { textAlign: 'center', fontSize: 20, marginVertical: 8 },
  avail: { fontSize: 12, marginVertical: 8 },
  success: { color: '#10B981', marginVertical: 8 },
  footer: { marginTop: 16 },
});
