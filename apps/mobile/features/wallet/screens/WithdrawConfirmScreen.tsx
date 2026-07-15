import { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { estimateArrivalTime } from '@core/domain/wallet/deposit';
import { mapWithdrawApiError } from '@core/domain/wallet/withdraw';
import { useCreateWithdrawal, useKycStatus } from '../hooks/useBlockchainWallet';
import { WithdrawFlowHeader } from '../components/WithdrawFlowHeader';
import { WithdrawReviewCard } from '../components/WithdrawReviewCard';
import { WithdrawSecurityWizard } from '../components/WithdrawSecurityWizard';
import type { WalletStackParamList } from '../navigation/types';

type SecurityInput = { twoFactorCode?: string; fund_password?: string };

type Props = NativeStackScreenProps<WalletStackParamList, 'WithdrawConfirm'>;

export function WithdrawConfirmScreen({ navigation, route }: Props) {
  const p = route.params;
  const isOnline = useAppStore((s) => s.isOnline);
  const kycQ = useKycStatus();
  const withdraw = useCreateWithdrawal();
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultId, setResultId] = useState<string | null>(null);
  const [needsEmailOtp, setNeedsEmailOtp] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastSecurity, setLastSecurity] = useState<SecurityInput>({});

  useEffect(() => {
    analytics.screen('S-522');
  }, []);

  const submit = async (security: SecurityInput) => {
    setError(null);
    setLastSecurity(security);
    if (!isOnline) {
      setError('Offline — cannot withdraw until reconnected');
      return;
    }
    if (!kycQ.data?.verified && kycQ.data) {
      setError('Complete KYC verification before withdrawing.');
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
        setSuccess(true);
        navigation.replace('WithdrawalDetail', { withdrawalId: res.id, snapshot: res });
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(mapWithdrawApiError(err.code, err.message, err.payload));
      } else {
        setError('Withdrawal failed');
      }
    }
  };

  const onReview = () => {
    if (p.needs2FA || p.needsFundPassword) {
      setShowWizard(true);
    } else {
      void submit({});
    }
  };

  const onRefresh = useCallback(() => void kycQ.refetch(), [kycQ]);

  return (
    <ScreenLayout testID="S-522">
      <ScrollView refreshControl={<RefreshControl refreshing={kycQ.isFetching} onRefresh={onRefresh} />}>
        <WithdrawFlowHeader
          symbol={p.symbol}
          name={p.symbol}
          network={p.chainName}
          available={p.available}
          withdrawEnabled
          step="Step 4 · Confirm withdrawal"
        />

        {!isOnline ? <ErrorBanner message="Offline — cannot submit withdrawal" /> : null}
        {!kycQ.data?.verified && kycQ.data ? (
          <ErrorBanner message="KYC verification may be required before withdrawing." />
        ) : null}

        <WithdrawReviewCard
          symbol={p.symbol}
          chainName={p.chainName}
          address={p.address}
          memo={p.memo}
          amount={p.amount}
          fee={p.preview?.fee}
          netAmount={p.preview?.net_amount}
          arrivalHint={estimateArrivalTime(p.confirmations, p.chainType)}
        />

        {error ? <ErrorBanner message={error} onRetry={() => void submit(lastSecurity)} /> : null}
        {success ? null : (
          <PrimaryButton title="Submit Withdrawal" loading={withdraw.isPending} onPress={onReview} />
        )}
      </ScrollView>
      <WithdrawSecurityWizard
        visible={showWizard}
        withdrawalId={resultId ?? undefined}
        needs2FA={needsEmailOtp ? false : p.needs2FA}
        needsFundPassword={needsEmailOtp ? false : p.needsFundPassword}
        needsEmailOtp={needsEmailOtp}
        onClose={() => setShowWizard(false)}
        onComplete={(input) => {
          if (needsEmailOtp && resultId) {
            setShowWizard(false);
            navigation.replace('WithdrawalDetail', { withdrawalId: resultId });
          } else {
            setShowWizard(false);
            void submit(input);
          }
        }}
      />
    </ScreenLayout>
  );
}
