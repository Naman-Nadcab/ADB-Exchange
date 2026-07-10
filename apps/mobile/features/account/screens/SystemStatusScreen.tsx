import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getPublicRepository } from '@core/repositories/PublicRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SystemStatus'>;

export function SystemStatusScreen(_props: Props) {
  const [status, setStatus] = useState('checking…');

  useEffect(() => {
    analytics.screen('S-791');
    void getPublicRepository().getHealth().then((h) => setStatus(h.status));
  }, []);

  return (
    <ScreenLayout testID="S-791">
      <Text>API status: {status}</Text>
    </ScreenLayout>
  );
}
