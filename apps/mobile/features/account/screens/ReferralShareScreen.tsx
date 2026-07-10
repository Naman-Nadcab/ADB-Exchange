import { useEffect } from 'react';
import { Share, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useReferralAnalytics } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'ReferralShare'>;

export function ReferralShareScreen(_props: Props) {
  const q = useReferralAnalytics();

  useEffect(() => {
    analytics.screen('S-744');
  }, []);

  const code = q.data?.referral_code ?? '';
  const link = `https://app.metheorium.com/referral/${code}`;

  return (
    <ScreenLayout testID="S-744">
      <Text>Referral code: {code}</Text>
      <Text>{link}</Text>
      <PrimaryButton title="Share" onPress={() => void Share.share({ message: `Join METHErium: ${link}` })} />
    </ScreenLayout>
  );
}
