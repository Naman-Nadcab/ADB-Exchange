import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useKycStatus } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'KYCHub'>;

export function KYCHubScreen({ navigation }: Props) {
  const q = useKycStatus();

  useEffect(() => {
    analytics.screen('S-730');
  }, []);

  const k = q.data;
  return (
    <ScreenLayout testID="S-730">
      <ScrollView>
        <Text>Status: {k?.status ?? '—'}</Text>
        <Text>Level: {k?.kycLevel ?? k?.kyc_level ?? 0}</Text>
        <Text>Verified: {k?.verified ? 'Yes' : 'No'}</Text>
        {k?.rejectionReason || k?.rejection_reason ? (
          <Text>Reason: {k.rejectionReason ?? k.rejection_reason}</Text>
        ) : null}
        {k?.status === 'rejected' || k?.status === 'not_submitted' ? (
          <PrimaryButton title="Start / Retry KYC" onPress={() => navigation.navigate('KYCDocument')} />
        ) : null}
        {k?.status === 'approved' || k?.verified ? (
          <PrimaryButton title="View result" variant="secondary" onPress={() => navigation.navigate('KYCResult')} />
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}
