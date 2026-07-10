import { useEffect, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { useCreateWithdrawal } from '../hooks/useBlockchainWallet';
import { FeePreviewCard } from '../components/FeePreviewCard';
import { WithdrawSecurityWizard } from '../components/WithdrawSecurityWizard';
import type { WalletStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawConfirm'>;

export function WithdrawConfirmScreen({ navigation, route }: Props) {
  const p = route.params;
  const { theme } = useTheme();
  const isOnline = useAppStore((s) => s.isOnline);
  const withdraw = useCreateWithdrawal();
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [needsEmailOtp, setNeedsEmailOtp] = useState(false);

  useEffect(() => {
    analytics.screen('S-522');
  }, []);

  const submit = async (security: { twoFactorCode?: string; fund_password?: string }) => {
    setError(null);
    if (!isOnline) {
      setError('Offline — cannot withdraw');
      return;
    }
    try {
      const res = await withdraw.mutateAsync({
        symbol: p.symbol,
        chainId: p.chainId,
        amount: p.amount,
        toAddress: p.address,
        memo: p.memo,
        twoFactorCode: security.twoFactorCode,
        fund_password: security.fund_password,
        withdrawalAddressId: p.withdrawalAddressId,
      });
      setResultId(res.id);
      if (res.status === 'pending_email_verify') {
        setNeedsEmailOtp(true);
        setShowWizard(true);
      } else {
        navigation.replace('WithdrawalDetail', { withdrawalId: res.id });
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Withdrawal failed');
    }
  };

  const onReview = () => {
    if (p.needs2FA || p.needsFundPassword) {
      setShowWizard(true);
    } else {
      void submit({});
    }
  };

  return (
    <ScreenLayout testID="S-522">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Confirm Withdrawal</Text>
        <Text style={styles.row}>Asset: {p.symbol}</Text>
        <Text style={styles.row}>Network: {p.chainName}</Text>
        <Text style={styles.row}>Address: {p.address}</Text>
        {p.memo ? <Text style={styles.row}>Memo: {p.memo}</Text> : null}
        <Text style={styles.row}>Amount: {p.amount}</Text>
        <FeePreviewCard preview={p.preview} available={p.available} symbol={p.symbol} />
        {error ? <ErrorBanner message={error} /> : null}
        <PrimaryButton title="Submit Withdrawal" loading={withdraw.isPending} onPress={onReview} />
      </ScrollView>
      <WithdrawSecurityWizard
        visible={showWizard}
        withdrawalId={resultId ?? undefined}
        needs2FA={needsEmailOtp ? false : p.needs2FA}
        needsFundPassword={needsEmailOtp ? false : p.needsFundPassword}
        needsEmailOtp={needsEmailOtp}
        onClose={() => setShowWizard(false)}
        onComplete={(input) => {
          setShowWizard(false);
          if (needsEmailOtp && resultId) {
            navigation.replace('WithdrawalDetail', { withdrawalId: resultId });
          } else {
            void submit(input);
          }
        }}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: { marginBottom: 6, fontSize: 14 },
});
