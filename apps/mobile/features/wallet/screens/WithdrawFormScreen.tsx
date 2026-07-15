import { useEffect, useMemo, useState, useCallback } from 'react';
import { ScrollView, Text, Pressable, StyleSheet, RefreshControl, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import {
  ScreenLayout,
  TextField,
  PrimaryButton,
  ErrorBanner,
  SkeletonList,
  ErrorState,
  ExchangeCard,
} from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { needsMemoTag } from '@core/domain/wallet/deposit';
import {
  validateCryptoAddress,
  validateMemo,
  validateWithdrawAmount,
  validateWithdrawLimits,
  formatNetworkLabel,
  computeMaxWithdrawAmount,
  applyWithdrawPercent,
} from '@core/domain/wallet/withdraw';
import {
  useTokenChains,
  useFundingBalanceForSymbol,
  useWithdrawPreview,
  useWithdrawalFee,
  useWithdrawalAddresses,
  useWithdrawSecurityStatus,
  useWithdrawalLimits,
  useRecentWithdrawals,
  useKycStatus,
  useRiskStatus,
} from '../hooks/useBlockchainWallet';
import { FeePreviewCard } from '../components/FeePreviewCard';
import { WithdrawFlowHeader } from '../components/WithdrawFlowHeader';
import { WithdrawLimitsCard } from '../components/WithdrawLimitsCard';
import { WithdrawRecentPreview } from '../components/WithdrawRecentPreview';
import { WithdrawWarningsSection } from '../components/WithdrawWarningsSection';
import { WithdrawHelpLinks } from '../components/WithdrawHelpLinks';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawForm'>;

export function WithdrawFormScreen({ navigation, route }: Props) {
  const {
    symbol,
    name,
    chainId: initialChainId,
    chainName: initialChainName,
    confirmations,
    prefillAddress,
    prefillMemo,
  } = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const chainsQ = useTokenChains(symbol);
  const balanceQ = useFundingBalanceForSymbol(symbol);
  const addressesQ = useWithdrawalAddresses();
  const security = useWithdrawSecurityStatus();
  const limitsQ = useWithdrawalLimits(symbol);
  const recentQ = useRecentWithdrawals(10, symbol);
  const kycQ = useKycStatus();
  const riskQ = useRiskStatus();

  const [chainId, setChainId] = useState(initialChainId ?? '');
  const [chainName, setChainName] = useState(initialChainName ?? '');
  const [address, setAddress] = useState(prefillAddress ?? '');
  const [memo, setMemo] = useState(prefillMemo ?? '');
  const [amount, setAmount] = useState('');
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const selectedChain = chainsQ.data?.find((c) => c.id === chainId);
  const feeQ = useWithdrawalFee(symbol, chainId);
  const previewQ = useWithdrawPreview(symbol, chainId, amount, !!amount && !!chainId);
  const memoRequired = needsMemoTag(symbol);
  const activeCooldown = riskQ.data?.active_cooldowns?.[0];

  useEffect(() => {
    analytics.screen('S-521');
  }, []);

  useEffect(() => {
    if (prefillAddress) setAddress(prefillAddress);
    if (prefillMemo != null) setMemo(prefillMemo);
  }, [prefillAddress, prefillMemo]);

  useEffect(() => {
    if (initialChainId) return;
    const active = (chainsQ.data ?? []).filter((c) => c.is_active !== false);
    if (active.length && !chainId) {
      setChainId(active[0].id);
      setChainName(active[0].name);
    }
  }, [chainsQ.data, chainId, initialChainId]);

  const savedForAsset = useMemo(() => {
    const sym = symbol.toUpperCase();
    const net = chainName.toLowerCase();
    return (addressesQ.data ?? []).filter((a) => {
      if ((a.asset ?? '').toUpperCase() !== sym) return false;
      if (!a.network) return true;
      const an = a.network.toLowerCase();
      return an.includes(net) || net.includes(an) || !chainName;
    });
  }, [addressesQ.data, symbol, chainName]);

  const onRefresh = useCallback(() => {
    void chainsQ.refetch();
    void balanceQ.refetch();
    void addressesQ.refetch();
    void limitsQ.refetch();
    void recentQ.refetch();
    void kycQ.refetch();
    void riskQ.refetch();
    void feeQ.refetch();
    if (amount) void previewQ.refetch();
  }, [chainsQ, balanceQ, addressesQ, limitsQ, recentQ, kycQ, riskQ, feeQ, previewQ, amount]);

  const applyMax = () => {
    const fee = previewQ.data?.fee ?? feeQ.data?.fee ?? '0';
    setAmount(computeMaxWithdrawAmount(balanceQ.available, fee));
    setPercent(100);
  };

  const onPercent = (pct: number) => {
    setPercent(pct);
    const fee = previewQ.data?.fee ?? feeQ.data?.fee ?? '0';
    setAmount(applyWithdrawPercent(balanceQ.available, fee, pct));
  };

  const pasteAddress = async () => {
    const text = (await Clipboard.getStringAsync()).trim();
    if (text) setAddress(text);
  };

  const proceed = () => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot withdraw until reconnected');
      return;
    }
    if (activeCooldown) {
      setError(
        `Withdrawals disabled until ${new Date(activeCooldown.cooldown_until).toLocaleString()} after a security change.`,
      );
      return;
    }
    if (!kycQ.data?.verified && kycQ.data) {
      setError('Complete KYC verification before withdrawing.');
      return;
    }
    if (!chainId) {
      setError('Select a network');
      return;
    }
    const addrErr = validateCryptoAddress(address);
    if (addrErr) {
      setError(addrErr);
      return;
    }
    const memoErr = validateMemo(memo, memoRequired);
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
    const limitErr = validateWithdrawLimits(amount, limitsQ.data?.daily.remaining, limitsQ.data?.monthly.remaining);
    if (limitErr) {
      setError(limitErr);
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
    if (security.addressLock.data?.enabled && !selected?.is_whitelisted) {
      setError('New address lock enabled — use a whitelisted saved address');
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
      confirmations: confirmations ?? selectedChain?.confirmations_required,
      chainType: selectedChain?.type,
    });
  };

  const loading = (chainsQ.isLoading || balanceQ.isLoading) && !chainId;
  const stepLabel = initialChainId ? 'Step 3 · Address & amount' : 'Step 2 · Network, address & amount';

  return (
    <ScreenLayout testID="S-521">
      <ScrollView
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={balanceQ.isFetching} onRefresh={onRefresh} />}
      >
        <WithdrawFlowHeader
          symbol={symbol}
          name={name}
          network={chainName ? formatNetworkLabel(chainName, confirmations) : undefined}
          available={balanceQ.available}
          withdrawEnabled={chainId ? selectedChain?.is_active !== false : true}
          step={stepLabel}
        />

        {!isOnline ? <ErrorBanner message="Offline — balances and fees may be stale" onRetry={onRefresh} /> : null}
        {!kycQ.data?.verified && kycQ.data ? (
          <ErrorBanner
            message="KYC verification may be required before withdrawing."
            onRetry={() => navigation.getParent()?.navigate('Account', { screen: 'KYCHub' })}
          />
        ) : null}
        {activeCooldown ? (
          <ErrorBanner
            message={`Withdrawals paused until ${new Date(activeCooldown.cooldown_until).toLocaleString()} — ${activeCooldown.reason}`}
          />
        ) : null}

        {loading ? (
          <SkeletonList rows={6} />
        ) : (
          <>
            <WithdrawLimitsCard limits={limitsQ.data} symbol={symbol} loading={limitsQ.isLoading} />

            {!initialChainId ? (
              <>
                <Text style={[styles.section, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Network</Text>
                {(chainsQ.data ?? []).map((c) => {
                  const disabled = c.is_active === false;
                  return (
                    <Pressable
                      key={c.id}
                      disabled={disabled}
                      accessibilityLabel={`${c.name}${disabled ? ' maintenance' : ''}`}
                      onPress={() => {
                        setChainId(c.id);
                        setChainName(c.name);
                      }}
                      style={[styles.chip, disabled && styles.disabled]}
                    >
                      <Text style={{ fontWeight: chainId === c.id ? '700' : '400', opacity: disabled ? 0.5 : 1 }}>
                        {formatNetworkLabel(c.name, c.confirmations_required)}
                        {disabled ? ' · Maintenance' : ''}
                      </Text>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <View style={styles.sectionRow}>
              <Text style={[styles.section, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Address</Text>
              <Pressable
                onPress={() =>
                  navigation.navigate('AddressBook', {
                    selectMode: true,
                    symbol,
                    name,
                    chainId,
                    chainName,
                    confirmations,
                  })
                }
              >
                <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '600', fontSize: 13 }}>Address book</Text>
              </Pressable>
            </View>

            {savedForAsset.length ? (
              <ExchangeCard variant="terminal" style={styles.savedCard}>
                {savedForAsset.slice(0, 6).map((a) => (
                  <Pressable
                    key={a.id}
                    accessibilityLabel={`Use saved address ${a.note ?? a.address}`}
                    onPress={() => {
                      setAddress(a.address);
                      setMemo(a.memo ?? '');
                    }}
                    style={styles.savedRow}
                  >
                    <Text style={{ color: `hsl(${theme.colors.foregroundPrimary})`, fontWeight: '600' }}>
                      {a.note ?? `${a.address.slice(0, 10)}…`}
                    </Text>
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11 }}>
                      {a.is_whitelisted ? 'Whitelisted ★' : 'Saved'}
                    </Text>
                  </Pressable>
                ))}
              </ExchangeCard>
            ) : null}

            <TextField label="Withdrawal address" value={address} onChangeText={setAddress} />
            <PrimaryButton title="Paste from clipboard" variant="secondary" onPress={() => void pasteAddress()} />

            <TextField
              label={memoRequired ? 'Memo / Tag (required)' : 'Memo / Tag (if required)'}
              value={memo}
              onChangeText={setMemo}
            />

            <TextField label="Amount" value={amount} onChangeText={(v) => { setAmount(v); setPercent(0); }} keyboardType="decimal-pad" />

            <FeePreviewCard
              preview={previewQ.data}
              available={balanceQ.available}
              symbol={symbol}
              isLoading={previewQ.isFetching && !!amount}
              onMax={applyMax}
              percent={percent}
              onPercentChange={onPercent}
            />

            {chainName ? (
              <WithdrawWarningsSection
                symbol={symbol}
                chainName={chainName}
                minWithdrawal={feeQ.data?.minWithdrawal ?? previewQ.data?.min_withdrawal}
                confirmations={confirmations ?? selectedChain?.confirmations_required}
                chainType={selectedChain?.type}
              />
            ) : null}

            {security.whitelist.data?.enabled ? (
              <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12 }}>
                Whitelist enabled — only whitelisted addresses can withdraw.
              </Text>
            ) : null}
            {security.addressLock.data?.enabled ? (
              <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12 }}>
                New address lock active — recently added addresses may be blocked.
              </Text>
            ) : null}
            {security.twoFa.data?.enabled ? (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                Google Authenticator (2FA) will be required on confirmation.
              </Text>
            ) : null}
            {security.fundPw.data?.enabled ? (
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                Fund password will be required on confirmation.
              </Text>
            ) : null}

            {error ? <ErrorBanner message={error} /> : null}
            {chainsQ.isError ? <ErrorState title="Networks unavailable" onRetry={onRefresh} /> : null}

            <PrimaryButton title="Review Withdrawal" onPress={proceed} disabled={!!activeCooldown} />

            <WithdrawHelpLinks />

            <WithdrawRecentPreview
              items={recentQ.data ?? []}
              isLoading={recentQ.isLoading}
              error={recentQ.isError}
              onRetry={() => void recentQ.refetch()}
              onViewAll={() => navigation.navigate('WithdrawalHistory')}
              onSelect={(id) => navigation.navigate('WithdrawalDetail', { withdrawalId: id })}
            />
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  section: { fontWeight: '700', marginTop: 12, marginBottom: 6 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  chip: { paddingVertical: 8 },
  disabled: { opacity: 0.45 },
  savedCard: { marginBottom: 10, paddingVertical: 0, paddingHorizontal: 0 },
  savedRow: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
});
