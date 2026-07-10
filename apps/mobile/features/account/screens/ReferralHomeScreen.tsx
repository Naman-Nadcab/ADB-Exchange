import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useReferralAnalytics } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralHome'>;

export function ReferralHomeScreen({ navigation }: Props) {
  const q = useReferralAnalytics();

  useEffect(() => {
    analytics.screen('S-742');
  }, []);

  const r = q.data;
  return (
    <ScreenLayout testID="S-742">
      <ScrollView>
        <Text>Code: {r?.referral_code ?? '—'}</Text>
        <Text>Total referrals: {r?.total_referrals ?? 0}</Text>
        <Text>Commission: {r?.total_commission ?? '0'}</Text>
        <AccountMenuRow label="My referrals" onPress={() => navigation.navigate('ReferralList')} />
        <PrimaryButton title="Share referral" onPress={() => navigation.navigate('ReferralShare')} />
      </ScrollView>
    </ScreenLayout>
  );
}
