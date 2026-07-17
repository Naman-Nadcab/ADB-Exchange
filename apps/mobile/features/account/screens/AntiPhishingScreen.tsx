import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AntiPhishing'>;

export function AntiPhishingScreen(_props: Props) {
  const { theme } = useTheme();
  const [code, setCode] = useState('');

  useEffect(() => {
    analytics.screen('S-715');
    void getAuthRepository().getAntiPhishingStatus().then((s) => setCode(s.code ?? ''));
  }, []);

  return (
    <ScreenLayout testID="S-715">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
          Set a code shown in official emails to help detect phishing attempts.
        </Text>
        <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
          <TextField label="Anti-phishing code" value={code} onChangeText={setCode} />
          <PrimaryButton title="Save" onPress={() => void getAuthRepository().setAntiPhishing(code)} />
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
