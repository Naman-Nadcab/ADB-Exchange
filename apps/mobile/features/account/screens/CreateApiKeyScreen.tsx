import { useEffect, useState } from 'react';
import { ScrollView, Text, Alert } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'CreateApiKey'>;

export function CreateApiKeyScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-751');
  }, []);

  const create = async () => {
    const res = await getAuthRepository().createApiKey({ label });
    const s = res.secret ?? res.api_key;
    if (s) {
      setSecret(s);
      Alert.alert('Save your secret', 'This will only be shown once.', [{ text: 'OK' }]);
    } else {
      navigation.goBack();
    }
  };

  return (
    <ScreenLayout testID="S-751">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
          <TextField label="Label" value={label} onChangeText={setLabel} />
          {secret ? (
            <Text
              selectable
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono, fontVariant: ['tabular-nums'] },
              ]}
            >
              Secret: {secret}
            </Text>
          ) : null}
          <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
            Never share your API secret. Store it securely.
          </Text>
          <PrimaryButton title="Create" onPress={() => void create()} />
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
