import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { appLock } from '@core/security/appLock';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AppLockSettings'>;

export function AppLockSettingsScreen(_props: Props) {
  const { theme } = useTheme();
  const [enabled, setEnabled] = useState(false);
  const [timeout, setTimeoutSec] = useState('60');
  const [bio, setBio] = useState(false);

  useEffect(() => {
    void (async () => {
      setEnabled(await appLock.isEnabled());
      setTimeoutSec(String(await appLock.getTimeoutSec()));
      setBio(await appLock.canUseBiometrics());
    })();
  }, []);

  return (
    <ScreenLayout>
      <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[3] }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
            minHeight: theme.listDensity.settings.rowHeight,
          }}
        >
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
            App lock
          </Text>
          <Switch
            value={enabled}
            onValueChange={(v) => {
              setEnabled(v);
              void appLock.setEnabled(v);
            }}
            accessibilityLabel="App lock"
          />
        </View>
      </ExchangeCard>

      <ExchangeCard variant="terminal" style={{ marginBottom: theme.spacing[3] }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
          <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Biometrics available</Text>
          <StatusChip label={bio ? 'Yes' : 'No'} tone={bio ? 'live' : 'neutral'} />
        </View>
      </ExchangeCard>

      <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
        <TextField label="Lock timeout (seconds)" value={timeout} onChangeText={setTimeoutSec} keyboardType="number-pad" />
        <PrimaryButton title="Save timeout" onPress={() => void appLock.setTimeoutSec(parseInt(timeout, 10) || 60)} />
      </ExchangeCard>
    </ScreenLayout>
  );
}
