import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ErrorBanner, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'TwoFA'>;

export function TwoFAScreen(_props: Props) {
  const { theme } = useTheme();
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    analytics.screen('S-712');
    void getAuthRepository().get2FAStatus().then((s) => setEnabled(s.enabled));
  }, []);

  const setup = async () => {
    const res = await getAuthRepository().setup2FA();
    setSecret(res.secret ?? '');
  };

  const enable = async () => {
    try {
      await getAuthRepository().enable2FA(code);
      setEnabled(true);
    } catch {
      setError('Invalid code');
    }
  };

  const disable = async () => {
    try {
      await getAuthRepository().disable2FA(code);
      setEnabled(false);
    } catch {
      setError('Invalid code');
    }
  };

  return (
    <ScreenLayout testID="S-712">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <ExchangeCard elevated>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
            <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Two-factor authentication</Text>
            <StatusChip label={enabled ? 'Enabled' : 'Disabled'} tone={enabled ? 'live' : 'off'} />
          </View>
        </ExchangeCard>

        <ExchangeCard variant="terminal">
          {!enabled ? <PrimaryButton title="Setup 2FA" onPress={() => void setup()} /> : null}
          {secret ? (
            <Text
              selectable
              style={[
                theme.typography.bodySm,
                { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.mono, marginTop: theme.spacing[3], fontVariant: ['tabular-nums'] },
              ]}
            >
              Secret: {secret}
            </Text>
          ) : null}
          <View style={{ marginTop: theme.spacing[3], gap: theme.spacing[3] }}>
            <TextField label="2FA Code" value={code} onChangeText={setCode} keyboardType="number-pad" />
            {error ? <ErrorBanner message={error} /> : null}
            {enabled ? (
              <PrimaryButton title="Disable 2FA" variant="secondary" onPress={() => void disable()} />
            ) : (
              <PrimaryButton title="Enable 2FA" onPress={() => void enable()} />
            )}
          </View>
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
