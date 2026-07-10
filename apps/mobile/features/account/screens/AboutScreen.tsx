import { useEffect } from 'react';
import { ScrollView } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { analytics } from '@core/observability/analytics';
import Constants from 'expo-constants';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'About'>;

export function AboutScreen({ navigation }: Props) {
  useEffect(() => {
    analytics.screen('S-790');
  }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenLayout testID="S-790">
      <ScrollView>
        <AccountMenuRow label={`Version ${version}`} onPress={() => {}} />
        <AccountMenuRow label="Terms of Service" onPress={() => navigation.navigate('LegalViewer', { doc: 'terms' })} />
        <AccountMenuRow label="Privacy Policy" onPress={() => navigation.navigate('LegalViewer', { doc: 'privacy' })} />
        <AccountMenuRow label="Licenses" onPress={() => navigation.navigate('LegalViewer', { doc: 'licenses' })} />
        <AccountMenuRow label="Account deletion" onPress={() => navigation.navigate('AccountDeletion')} />
      </ScrollView>
    </ScreenLayout>
  );
}
