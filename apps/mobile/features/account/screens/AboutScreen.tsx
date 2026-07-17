import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import Constants from 'expo-constants';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'About'>;

export function AboutScreen({ navigation }: Props) {
  const { theme } = useTheme();

  useEffect(() => {
    analytics.screen('S-790');
  }, []);

  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScreenLayout testID="S-790">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        <Text
          style={[
            theme.typography.labelSm,
            {
              color: `hsl(${theme.colors.foregroundSecondary})`,
              fontFamily: theme.fonts.sansSemiBold,
              textTransform: 'uppercase',
              marginBottom: theme.spacing[2],
              marginLeft: theme.spacing[1],
            },
          ]}
        >
          App info
        </Text>
        <ExchangeCard variant="terminal" padded={false}>
          <View style={{ paddingHorizontal: theme.spacing[2] }}>
            <AccountMenuRow label={`Version ${version}`} onPress={() => {}} />
            <AccountMenuRow label="Terms of Service" onPress={() => navigation.navigate('LegalViewer', { doc: 'terms' })} />
            <AccountMenuRow label="Privacy Policy" onPress={() => navigation.navigate('LegalViewer', { doc: 'privacy' })} />
            <AccountMenuRow label="Licenses" onPress={() => navigation.navigate('LegalViewer', { doc: 'licenses' })} />
            <AccountMenuRow label="Account deletion" onPress={() => navigation.navigate('AccountDeletion')} />
          </View>
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
