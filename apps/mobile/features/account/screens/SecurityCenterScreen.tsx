import { useEffect } from 'react';
import { ScrollView, Text } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import { useSecuritySettings } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';
import type { SecurityChecklistItem } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SecurityCenter'>;

export function SecurityCenterScreen({ navigation }: Props) {
  const q = useSecuritySettings();

  useEffect(() => {
    analytics.screen('S-710');
  }, []);

  const s = q.data;
  const score = s?.score ?? 0;

  return (
    <ScreenLayout testID="S-710">
      <ScrollView>
        <Text>Security score: {score}%</Text>
        {(s?.checklist ?? []).map((item: SecurityChecklistItem) => (
          <Text key={item.id}>
            {item.done ? '✓' : '○'} {item.label}
          </Text>
        ))}
        <AccountMenuRow label="Change password" onPress={() => navigation.navigate('ChangePassword')} />
        <AccountMenuRow label="2FA" sub={s?.twoFaEnabled ? 'Enabled' : 'Off'} onPress={() => navigation.navigate('TwoFA')} />
        <AccountMenuRow label="Passkeys" onPress={() => navigation.navigate('Passkeys')} />
        <AccountMenuRow label="Fund password" onPress={() => navigation.navigate('FundPassword')} />
        <AccountMenuRow label="Anti-phishing code" onPress={() => navigation.navigate('AntiPhishing')} />
        <AccountMenuRow label="App lock & biometrics" onPress={() => navigation.navigate('AppLockSettings')} />
        <AccountMenuRow label="Active sessions" onPress={() => navigation.navigate('Sessions')} />
        <AccountMenuRow label="Login history" onPress={() => navigation.navigate('LoginHistory')} />
        <AccountMenuRow label="Withdrawal limits" onPress={() => navigation.navigate('WithdrawalLimits')} />
        <AccountMenuRow label="Withdrawal whitelist" onPress={() => navigation.navigate('Whitelist')} />
      </ScrollView>
    </ScreenLayout>
  );
}
