import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Whitelist'>;

export function WhitelistScreen(_props: Props) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    analytics.screen('S-718');
    void getAuthRepository().getWhitelistStatus().then((s) => setOn(s.enabled));
  }, []);

  return (
    <ScreenLayout testID="S-718">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 }}>
        <Text>Withdrawal whitelist</Text>
        <Switch value={on} onValueChange={(v) => { setOn(v); void getAuthRepository().toggleWhitelist(v); }} />
      </View>
    </ScreenLayout>
  );
}
