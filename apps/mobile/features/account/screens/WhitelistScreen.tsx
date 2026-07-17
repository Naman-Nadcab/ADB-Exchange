import { useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { getAuthRepository } from '@core/repositories/AuthRepository';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Whitelist'>;

export function WhitelistScreen(_props: Props) {
  const { theme } = useTheme();
  const [on, setOn] = useState(false);

  useEffect(() => {
    analytics.screen('S-718');
    void getAuthRepository().getWhitelistStatus().then((s) => setOn(s.enabled));
  }, []);

  return (
    <ScreenLayout testID="S-718">
      <ExchangeCard variant="terminal">
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.spacing[3],
            minHeight: theme.listDensity.settings.rowHeight,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
              Withdrawal whitelist
            </Text>
            <Text style={[theme.typography.bodySm, { color: `hsl(${theme.colors.foregroundSecondary})`, marginTop: theme.spacing[0.5] }]}>
              Restrict withdrawals to saved addresses only
            </Text>
          </View>
          <Switch
            value={on}
            onValueChange={(v) => {
              setOn(v);
              void getAuthRepository().toggleWhitelist(v);
            }}
            accessibilityLabel="Withdrawal whitelist"
          />
        </View>
      </ExchangeCard>
    </ScreenLayout>
  );
}
