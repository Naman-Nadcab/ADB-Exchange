import { useEffect } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AvatarEdit'>;

export function AvatarEditScreen(_props: Props) {
  useEffect(() => {
    analytics.screen('S-702');
  }, []);

  return (
    <ScreenLayout testID="S-702">
      <Text>Avatar upload uses POST /user/avatar (multipart). Select image from device to update.</Text>
    </ScreenLayout>
  );
}
