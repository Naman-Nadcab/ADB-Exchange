import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable, StyleSheet, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  ScreenLayout,
  TextField,
  PrimaryButton,
  SkeletonList,
  EmptyState,
  ErrorState,
  ErrorBanner,
  ExchangeCard,
} from '@shared/ui';
import { useTheme, hsl } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { bankLabelFromPaymentMethod, formatInr } from '@core/domain/wallet/fiat';
import { useMyPaymentMethods } from '../../p2p/hooks/useP2P';
import { useFiatBalance, useFiatWithdrawals, useCancelFiatWithdrawal } from '../hooks/useWallet';
import { WithdrawTypeNav } from '../components/WithdrawTypeNav';
import { FiatWithdrawalHistoryRow } from '../components/FiatWithdrawalHistoryRow';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'FiatWithdraw'>;

export function FiatWithdrawHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const [amount, setAmount] = useState('');
  const [bankAccountId, setBankAccountId] = useState('');

  const balanceQ = useFiatBalance();
  const banksQ = useMyPaymentMethods();
  const historyQ = useFiatWithdrawals();
  const cancel = useCancelFiatWithdrawal();

  useEffect(() => {
    analytics.screen('S-526');
  }, []);

  const banks = banksQ.data ?? [];
  const available = balanceQ.data?.available_balance ?? '0';
  const selectedBank = useMemo(() => banks.find((b) => b.id === bankAccountId), [banks, bankAccountId]);

  const amountNum = Number(amount);
  const availNum = Number(available);
  const amountInvalid = !amount || !Number.isFinite(amountNum) || amountNum <= 0;
  const overBalance = Number.isFinite(amountNum) && amountNum > availNum;
  const canContinue = !amountInvalid && !overBalance && !!bankAccountId;

  const refreshing = balanceQ.isFetching || banksQ.isFetching || historyQ.isFetching;
  const onRefresh = useCallback(() => {
    void balanceQ.refetch();
    void banksQ.refetch();
    void historyQ.refetch();
  }, [balanceQ, banksQ, historyQ]);

  const onContinue = () => {
    if (!selectedBank || !canContinue) return;
    navigation.navigate('FiatWithdrawConfirm', {
      amount: amount.trim(),
      bankAccountId,
      bankLabel: bankLabelFromPaymentMethod(selectedBank),
      methodName: selectedBank.method_name,
      available,
    });
  };

  const openPaymentMethods = () => {
    navigation.getParent()?.navigate('P2P', { screen: 'PaymentMethods' });
  };

  return (
    <ScreenLayout testID="S-526">
      <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        <Text
          style={[
            theme.typography.headingLg,
            { color: hsl(theme.colors.foregroundPrimary), fontFamily: theme.fonts.sansBold, marginBottom: theme.spacing[1] },
          ]}
        >
          Fiat withdrawal
        </Text>
        <Text
          style={[
            theme.typography.bodyMd,
            { color: hsl(theme.colors.foregroundSecondary), lineHeight: 18, marginBottom: theme.spacing[3] },
          ]}
        >
          Withdraw your INR balance to a saved bank account or UPI. Requests are reviewed and settled by the team.
        </Text>

        <WithdrawTypeNav
          active="fiat"
          onCrypto={() => navigation.navigate('WithdrawHome')}
          onFiat={() => undefined}
        />

        {!isOnline ? <ErrorBanner message="Offline — balances and history may be stale" onRetry={onRefresh} /> : null}

        <ExchangeCard elevated style={styles.formCard}>
          <View style={styles.formHeader}>
            <View style={[styles.iconCircle, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.12)` }]}>
              <Ionicons name="cash-outline" size={22} color={`hsl(${theme.colors.brandPrimary})`} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>Withdraw INR</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                Available: {balanceQ.isLoading ? '—' : formatInr(available)}
              </Text>
            </View>
          </View>

          {balanceQ.isError ? (
            <ErrorBanner message="Could not load INR balance" onRetry={() => void balanceQ.refetch()} />
          ) : null}

          <Text style={[styles.fieldLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Amount (INR)</Text>
          <View style={styles.amountRow}>
            <View style={{ flex: 1 }}>
              <TextField value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
            </View>
            <Pressable
              onPress={() => setAmount(available)}
              style={[styles.maxBtn, { backgroundColor: `hsl(${theme.colors.surfaceMuted})` }]}
            >
              <Text style={{ fontWeight: '700', fontSize: 12, color: `hsl(${theme.colors.foregroundPrimary})` }}>Max</Text>
            </Pressable>
          </View>
          {overBalance ? (
            <Text style={{ color: `hsl(${theme.colors.statusWarning})`, fontSize: 12, marginBottom: 8 }}>
              Amount exceeds your available INR balance.
            </Text>
          ) : null}

          <Text style={[styles.fieldLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>Destination account</Text>
          {banksQ.isLoading ? (
            <SkeletonList rows={2} />
          ) : banks.length === 0 ? (
            <Pressable
              onPress={openPaymentMethods}
              style={[styles.emptyBank, { borderColor: `hsl(${theme.colors.borderDefault})` }]}
            >
              <Ionicons name="business-outline" size={18} color={`hsl(${theme.colors.foregroundSecondary})`} />
              <Text style={{ flex: 1, color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
                No bank account saved
              </Text>
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700', fontSize: 13 }}>Add account</Text>
            </Pressable>
          ) : (
            <View style={styles.bankList}>
              {banks.map((b) => {
                const selected = bankAccountId === b.id;
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => setBankAccountId(b.id)}
                    style={[
                      styles.bankRow,
                      {
                        borderColor: selected
                          ? `hsl(${theme.colors.brandPrimary})`
                          : `hsl(${theme.colors.borderDefault})`,
                        backgroundColor: selected
                          ? `hsl(${theme.colors.brandPrimary} / 0.08)`
                          : `hsl(${theme.colors.surfaceMuted} / 0.35)`,
                      },
                    ]}
                  >
                    <Text style={{ fontWeight: '600', color: `hsl(${theme.colors.foregroundPrimary})`, flex: 1 }}>
                      {bankLabelFromPaymentMethod(b)} · {b.method_name}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark-circle" size={18} color={`hsl(${theme.colors.brandPrimary})`} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
          {banks.length > 0 ? (
            <Pressable onPress={openPaymentMethods} style={styles.manageLink}>
              <Ionicons name="add" size={14} color={`hsl(${theme.colors.brandPrimary})`} />
              <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontSize: 12, fontWeight: '600' }}>
                Manage bank accounts
              </Text>
            </Pressable>
          ) : null}

          {selectedBank ? (
            <View style={[styles.preview, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 12 }}>
                Sending to{' '}
                <Text style={{ fontWeight: '700', color: `hsl(${theme.colors.foregroundPrimary})` }}>
                  {bankLabelFromPaymentMethod(selectedBank)}
                </Text>{' '}
                ({selectedBank.method_name})
              </Text>
            </View>
          ) : null}

          <PrimaryButton title="Continue" disabled={!canContinue} onPress={onContinue} style={{ marginTop: 12 }} />
        </ExchangeCard>

        <Text style={[styles.historyTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          Recent INR withdrawals
        </Text>
        {historyQ.isLoading && !historyQ.data ? (
          <SkeletonList rows={3} />
        ) : historyQ.isError ? (
          <ErrorState title="Could not load withdrawals" onRetry={() => void historyQ.refetch()} />
        ) : (historyQ.data?.length ?? 0) === 0 ? (
          <EmptyState title="No withdrawals yet" message="Your INR withdrawal requests will appear here." />
        ) : (
          historyQ.data!.map((w) => (
            <FiatWithdrawalHistoryRow
              key={w.id}
              item={w}
              onPress={() => navigation.navigate('FiatWithdrawalDetail', { withdrawalId: w.id, snapshot: w })}
              onCancel={() => cancel.mutate(w.id)}
              cancelPending={cancel.isPending}
            />
          ))
        )}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  formCard: { marginBottom: 16, padding: 14 },
  formHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  fieldLabel: { fontSize: 11, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  maxBtn: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, minHeight: 44, justifyContent: 'center' },
  emptyBank: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  bankList: { gap: 8 },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
  },
  manageLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  preview: { marginTop: 12, padding: 10, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  historyTitle: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
});
