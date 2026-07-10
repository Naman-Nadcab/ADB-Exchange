import { useEffect } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'WithdrawalLimits'>;

export function WithdrawalLimitsScreen(_props: Props) {
  useEffect(() => {
    analytics.screen('S-717');
    void getAuthRepository().getWithdrawalLimits();
  }, []);

  return (
    <ScreenLayout testID="S-717">
      <Text>Withdrawal limits loaded from backend. Configure via POST /auth/withdrawal-limits.</Text>
    </ScreenLayout>
  );
}
