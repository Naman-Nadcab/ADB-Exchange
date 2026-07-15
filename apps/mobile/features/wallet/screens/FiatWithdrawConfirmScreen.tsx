import { useEffect, useState, useCallback } from 'react';
import { ScrollView, RefreshControl } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, ErrorBanner, SkeletonList } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAppStore } from '@core/state/appStore';
import { ApiError } from '@core/api/errors/ApiError';
import { mapFiatWithdrawApiError } from '@core/domain/wallet/fiat';
import { useCreateFiatWithdrawal } from '../hooks/useWallet';
import { useWithdrawSecurityStatus } from '../hooks/useBlockchainWallet';
import { FiatWithdrawReviewCard } from '../components/FiatWithdrawReviewCard';
import { WithdrawSecurityWizard } from '../components/WithdrawSecurityWizard';
import type { WalletStackParamList } from '../navigation/types';

type SecurityInput = { twoFactorCode?: string; fund_password?: string };

type Props = NativeStackScreenProps<WalletStackParamList, 'FiatWithdrawConfirm'>;

export function FiatWithdrawConfirmScreen({ navigation, route }: Props) {
  const p = route.params;
  const isOnline = useAppStore((s) => s.isOnline);
  const create = useCreateFiatWithdrawal();
  const security = useWithdrawSecurityStatus();
  const [showWizard, setShowWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSecurity, setLastSecurity] = useState<SecurityInput>({});

  const needs2FA = !!security.twoFa.data?.enabled;
  const needsFundPassword = !!security.fundPw.data?.enabled;

  const paramsValid = !!p?.amount && !!p?.bankAccountId;

  useEffect(() => {
    analytics.screen('S-527');
  }, []);

  useEffect(() => {
    if (!paramsValid) navigation.replace('FiatWithdraw');
  }, [paramsValid, navigation]);

  if (!paramsValid) {
    return (
      <ScreenLayout testID="S-527">
        <SkeletonList rows={4} />
      </ScreenLayout>
    );
  }

  const submit = async (input: SecurityInput) => {
    setError(null);
    setLastSecurity(input);
    if (!isOnline) {
      setError('Offline — cannot withdraw until reconnected');
      return;
    }
    try {
      const res = await create.mutateAsync({
        amount: p.amount,
        bankAccountId: p.bankAccountId,
        twoFactorCode: input.twoFactorCode,
        fund_password: input.fund_password,
      });
      navigation.replace('FiatWithdrawalDetail', { withdrawalId: res.id, snapshot: res });
    } catch (err) {
      if (err instanceof ApiError) {
        setError(mapFiatWithdrawApiError(err.code, err.message));
      } else {
        setError('Withdrawal request failed');
      }
    }
  };

  const onSubmit = () => {
    if (needs2FA || needsFundPassword) {
      setShowWizard(true);
    } else {
      void submit({});
    }
  };

  const onRefresh = useCallback(() => {
    void security.twoFa.refetch();
    void security.fundPw.refetch();
  }, [security.twoFa, security.fundPw]);

  return (
    <ScreenLayout testID="S-527">
      <ScrollView refreshControl={<RefreshControl refreshing={security.twoFa.isFetching} onRefresh={onRefresh} />}>
        {!isOnline ? <ErrorBanner message="Offline — cannot submit withdrawal" /> : null}

        <FiatWithdrawReviewCard
          amount={p.amount}
          bankLabel={p.bankLabel}
          methodName={p.methodName}
          fee={undefined}
          netAmount={undefined}
        />

        {error ? <ErrorBanner message={error} onRetry={() => void submit(lastSecurity)} /> : null}

        <PrimaryButton title="Request withdrawal" loading={create.isPending} onPress={onSubmit} />
      </ScrollView>

      <WithdrawSecurityWizard
        visible={showWizard}
        needs2FA={needs2FA}
        needsFundPassword={needsFundPassword}
        needsEmailOtp={false}
        onClose={() => setShowWizard(false)}
        onComplete={(input) => {
          setShowWizard(false);
          void submit(input);
        }}
      />
    </ScreenLayout>
  );
}
