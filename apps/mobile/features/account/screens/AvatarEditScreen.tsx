import { useEffect } from 'react';
import { Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AvatarEdit'>;

export function AvatarEditScreen(_props: Props) {
  const { theme } = useTheme();

  useEffect(() => {
    analytics.screen('S-702');
  }, []);

  return (
    <ScreenLayout testID="S-702">
      <ExchangeCard variant="terminal">
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, lineHeight: 22 }]}>
          Avatar upload uses POST /user/avatar (multipart). Select image from device to update.
        </Text>
      </ExchangeCard>
    </ScreenLayout>
  );
}
