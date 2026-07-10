import { useEffect, useState } from 'react';
import { ScrollView, Text, Pressable, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import {
  validateCryptoAddress,
  validateMemo,
  validateWithdrawAmount,
  formatNetworkLabel,
} from '@core/domain/wallet/withdraw';
import {
  useTokenChains,
  useFundingBalanceForSymbol,
  useWithdrawPreview,
  useWithdrawalFee,
  useWithdrawalAddresses,
  useWithdrawSecurityStatus,
} from '../hooks/useBlockchainWallet';
import { FeePreviewCard } from '../components/FeePreviewCard';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawForm'>;

export function WithdrawFormScreen({ navigation, route }: Props) {
  const { symbol, name } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const chainsQ = useTokenChains(symbol);
  const balanceQ = useFundingBalanceForSymbol(symbol);
  const addressesQ = useWithdrawalAddresses();
  const security = useWithdrawSecurityStatus();

  const [chainId, setChainId] = useState('');
  const [chainName, setChainName] = useState('');
  const [address, setAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  const feeQ = useWithdrawalFee(symbol, chainId);
  const previewQ = useWithdrawPreview(symbol, chainId, amount, !!amount && !!chainId);

  useEffect(() => {
    analytics.screen('S-521');
  }, []);

  useEffect(() => {
    const active = (chainsQ.data ?? []).filter((c) => c.is_active !== false);
    if (active.length && !chainId) {
      setChainId(active[0].id);
      setChainName(active[0].name);
    }
  }, [chainsQ.data, chainId]);

  const proceed = () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot withdraw');
      return;
    }
    const addrErr = validateCryptoAddress(address);
    if (addrErr) {
      setError(addrErr);
      return;
    }
    const memoErr = validateMemo(memo, false);
    if (memoErr) {
      setError(memoErr);
      return;
    }
    const min = feeQ.data?.minWithdrawal ?? previewQ.data?.min_withdrawal ?? '0';
    const amtErr = validateWithdrawAmount(amount, balanceQ.available, min);
    if (amtErr) {
      setError(amtErr);
      return;
    }
    if (previewQ.data?.fee_exceeds_amount) {
      setError('Fee exceeds amount');
      return;
    }
    const selected = addressesQ.data?.find((a) => a.address === address);
    if (security.whitelist.data?.enabled && selected && !selected.is_whitelisted) {
      setError('Address is not whitelisted');
      return;
    }
    navigation.navigate('WithdrawConfirm', {
      symbol,
      chainId,
      chainName,
      address,
      memo,
      amount,
      preview: previewQ.data,
      available: balanceQ.available,
      withdrawalAddressId: selected?.id,
      needs2FA: !!security.twoFa.data?.enabled,
      needsFundPassword: !!security.fundPw.data?.enabled,
    });
  };

  return (
    <ScreenLayout testID="S-521">
      <ScrollView keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Withdraw {name}</Text>
        <Text style={styles.section}>Network</Text>
        {(chainsQ.data ?? []).map((c) => {
          const disabled = c.is_active === false;
          return (
            <Pressable
              key={c.id}
              disabled={disabled}
              onPress={() => {
                setChainId(c.id);
                setChainName(c.name);
              }}
              style={[styles.chip, disabled && styles.disabled]}
            >
              <Text style={{ fontWeight: chainId === c.id ? '700' : '400', opacity: disabled ? 0.5 : 1 }}>
                {formatNetworkLabel(c.name, c.confirmations_required)}
                {disabled ? ' · Unavailable' : ''}
              </Text>
            </Pressable>
          );
        })}
        <Text style={styles.section}>Saved addresses</Text>
        {(addressesQ.data ?? [])
          .filter((a) => a.asset === symbol)
          .slice(0, 5)
          .map((a) => (
            <Pressable
              key={a.id}
              onPress={() => {
                setAddress(a.address);
                setMemo(a.memo ?? '');
              }}
            >
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})` }}>
                {a.note ?? a.address.slice(0, 12)}… {a.is_whitelisted ? '★' : ''}
              </Text>
            </Pressable>
          ))}
        <TextField label="Address" value={address} onChangeText={setAddress} />
        <TextField label="Memo / Tag (if required)" value={memo} onChangeText={setMemo} />
        <TextField label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
        <FeePreviewCard
          preview={previewQ.data}
          available={balanceQ.available}
          symbol={symbol}
          isLoading={previewQ.isFetching}
        />
        {feeQ.data ? (
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
            Network fee: {feeQ.data.fee} {symbol} · Min: {feeQ.data.minWithdrawal} {symbol}
          </Text>
        ) : null}
        <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginTop: 8 }}>
          Withdrawals are irreversible. Verify address and network before submitting.
        </Text>
        {security.addressLock.data?.enabled ? (
          <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12 }}>
            New address lock is enabled — only whitelisted addresses may withdraw.
          </Text>
        ) : null}
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Review Withdrawal" onPress={proceed} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  section: { fontWeight: '600', marginTop: 12, marginBottom: 6 },
  chip: { paddingVertical: 8 },
  disabled: { opacity: 0.45 },
});
