import { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, TextField, PrimaryButton, ExchangeCard, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'FundPassword'>;

export function FundPasswordScreen(_props: Props) {
  const { theme } = useTheme();
  const [pw, setPw] = useState('');
  const [set, setIsSet] = useState(false);

  useEffect(() => {
    analytics.screen('S-714');
    void getAuthRepository().getFundPasswordStatus().then((s) => setIsSet(!!s.isSet));
  }, []);

  return (
    <ScreenLayout testID="S-714">
      <ScrollView contentContainerStyle={{ paddingBottom: theme.spacing.pageY, gap: theme.spacing[4] }}>
        <ExchangeCard elevated>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing[2] }}>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
              Fund password
            </Text>
            <StatusChip label={set ? 'Set' : 'Not set'} tone={set ? 'live' : 'neutral'} />
          </View>
        </ExchangeCard>
        <ExchangeCard variant="terminal" style={{ gap: theme.spacing[3] }}>
          <TextField label="Fund password" value={pw} onChangeText={setPw} secureTextEntry />
          <PrimaryButton title={set ? 'Update' : 'Set'} onPress={() => void getAuthRepository().setFundPassword(pw)} />
        </ExchangeCard>
      </ScrollView>
    </ScreenLayout>
  );
}
