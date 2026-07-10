import { useEffect } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useKycStatus } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCResult'>;

export function KYCResultScreen(_props: Props) {
  const q = useKycStatus();

  useEffect(() => {
    analytics.screen('S-735');
  }, []);

  return (
    <ScreenLayout testID="S-735">
      <Text>KYC Status: {q.data?.status}</Text>
      <Text>Verified: {q.data?.verified ? 'Yes' : 'No'}</Text>
    </ScreenLayout>
  );
}
