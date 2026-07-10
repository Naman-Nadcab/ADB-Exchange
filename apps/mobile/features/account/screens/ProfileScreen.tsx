import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useAuthProfile, useUserProfile } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

export function ProfileScreen({ navigation }: Props) {
  const authQ = useAuthProfile();
  const userQ = useUserProfile();

  useEffect(() => {
    analytics.screen('S-701');
  }, []);

  const p = authQ.data ?? userQ.data;
  return (
    <ScreenLayout testID="S-701">
      <ScrollView>
        <Text>Email: {p?.email ?? '—'}</Text>
        <Text>Phone: {p?.phone ?? '—'} {p?.phone_verified ? '✓' : ''}</Text>
        <Text>Country: —</Text>
        <Text>Referral: {p?.referral_code ?? '—'}</Text>
        <Text>Status: {p?.kyc_status ?? '—'}</Text>
        <AccountMenuRow label="Edit avatar" onPress={() => navigation.navigate('AvatarEdit')} />
      </ScrollView>
    </ScreenLayout>
  );
}
