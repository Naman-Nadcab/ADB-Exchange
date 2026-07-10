import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton } from '@shared/ui';
import { appLock } from '@core/security/appLock';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AppLockSettings'>;

export function AppLockSettingsScreen(_props: Props) {
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <Text>App lock</Text>
        <Switch
          value={enabled}
          onValueChange={(v) => {
            setEnabled(v);
            void appLock.setEnabled(v);
          }}
        />
      </View>
      <Text>Biometrics available: {bio ? 'Yes' : 'No'}</Text>
      <TextField label="Lock timeout (seconds)" value={timeout} onChangeText={setTimeoutSec} keyboardType="number-pad" />
      <PrimaryButton title="Save timeout" onPress={() => void appLock.setTimeoutSec(parseInt(timeout, 10) || 60)} />
    </ScreenLayout>
  );
}
