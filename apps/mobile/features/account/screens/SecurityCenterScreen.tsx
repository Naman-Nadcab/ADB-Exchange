import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, StatusChip, SkeletonList, ErrorState } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useSecuritySettings } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'SecurityCenter'>;

export function SecurityCenterScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const q = useSecuritySettings();

  useEffect(() => {
    analytics.screen('S-710');
  }, []);

  const s = q.data;
  const score = s?.score ?? 0;
  const checklist = s?.checklist ?? [];

  return (
    <ScreenLayout testID="S-710">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        {q.isLoading ? (
          <SkeletonList rows={8} />
        ) : q.isError ? (
          <ErrorState title="Could not load security settings" onRetry={() => void q.refetch()} />
        ) : (
          <>
            <ExchangeCard elevated style={{ marginBottom: theme.spacing.sectionGap }}>
              <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                Security score
              </Text>
              <Text
                style={[
                  theme.typography.displayMd,
                  { color: `hsl(${theme.colors.brandPrimary})`, marginTop: theme.spacing[2] },
                ]}
              >
                {score}%
              </Text>
            </ExchangeCard>

            {checklist.length > 0 ? (
              <ExchangeCard variant="terminal" padded={false} style={{ marginBottom: theme.spacing.sectionGap }}>
                <View style={{ paddingHorizontal: theme.spacing.cardPad, paddingTop: theme.spacing[3] }}>
                  <Text
                    style={[
                      theme.typography.labelMd,
                      {
                        color: `hsl(${theme.colors.foregroundSecondary})`,
                        fontFamily: theme.fonts.sansSemiBold,
                        textTransform: 'uppercase',
                        letterSpacing: 0.6,
                      },
                    ]}
                  >
                    Checklist
                  </Text>
                </View>
                {checklist.map((item, index) => (
                  <View
                    key={item.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingHorizontal: theme.spacing.cardPad,
                      paddingVertical: theme.spacing[2.5],
                      minHeight: theme.listDensity.settings.rowHeight,
                      borderBottomWidth: index < checklist.length - 1 ? 1 : 0,
                      borderBottomColor: `hsl(${theme.colors.borderDefault})`,
                    }}
                  >
                    <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundPrimary})`, flex: 1 }]}>
                      {item.label}
                    </Text>
                    <StatusChip label={item.done ? 'Done' : 'Pending'} tone={item.done ? 'live' : 'warn'} />
                  </View>
                ))}
              </ExchangeCard>
            ) : null}

            <ExchangeCard variant="terminal" padded={false}>
              <View style={{ paddingHorizontal: theme.spacing[2] }}>
                <AccountMenuRow
                  label="Change password"
                  sub="Not a sign-in method"
                  onPress={() => navigation.navigate('ChangePassword')}
                />
                <AccountMenuRow
                  label="2FA"
                  sub={s?.twoFaEnabled ? 'Enabled' : 'Off'}
                  onPress={() => navigation.navigate('TwoFA')}
                />
                <AccountMenuRow label="Passkeys" onPress={() => navigation.navigate('Passkeys')} />
                <AccountMenuRow label="Fund password" onPress={() => navigation.navigate('FundPassword')} />
                <AccountMenuRow label="Anti-phishing code" onPress={() => navigation.navigate('AntiPhishing')} />
                <AccountMenuRow label="App lock & biometrics" onPress={() => navigation.navigate('AppLockSettings')} />
                <AccountMenuRow label="Active sessions" onPress={() => navigation.navigate('Sessions')} />
                <AccountMenuRow label="Login history" onPress={() => navigation.navigate('LoginHistory')} />
                <AccountMenuRow label="Withdrawal limits" onPress={() => navigation.navigate('WithdrawalLimits')} />
                <AccountMenuRow label="Withdrawal whitelist" onPress={() => navigation.navigate('Whitelist')} />
              </View>
            </ExchangeCard>
          </>
        )}
      </ScrollView>
    </ScreenLayout>
  );
}
