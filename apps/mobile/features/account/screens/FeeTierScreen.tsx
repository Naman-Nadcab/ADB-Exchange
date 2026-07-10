import { useEffect } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useFeeTier } from '../hooks/useAccount';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'FeeTier'>;

export function FeeTierScreen(_props: Props) {
  const q = useFeeTier();

  useEffect(() => {
    analytics.screen('S-741');
  }, []);

  const t = q.data;
  return (
    <ScreenLayout testID="S-741">
      <Text>Tier: {t?.tier_name ?? t?.tier_level ?? '—'}</Text>
      <Text>Maker: {t?.maker_fee ?? '—'}</Text>
      <Text>Taker: {t?.taker_fee ?? '—'}</Text>
      <Text>VIP: {t?.vip ? 'Yes' : 'No'}</Text>
    </ScreenLayout>
  );
}
