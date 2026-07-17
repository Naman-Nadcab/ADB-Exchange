import { useEffect } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, ExchangeCard, Avatar, StatusChip } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthProfile, useUserProfile } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'Profile'>;

function Field({ label, value, verified }: { label: string; value: string; verified?: boolean }) {
  const { theme } = useTheme();
  return (
    <View
      style={{
        paddingVertical: theme.spacing[3.5],
        paddingHorizontal: theme.spacing[4],
        borderBottomWidth: 1,
        borderBottomColor: `hsl(${theme.colors.borderDefault})`,
      }}
    >
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: theme.spacing[1.5],
          },
        ]}
      >
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing[2], flexWrap: 'wrap' }}>
        <Text style={[theme.typography.bodyLg, { color: `hsl(${theme.colors.foregroundPrimary})`, fontFamily: theme.fonts.sansSemiBold }]}>
          {value}
        </Text>
        {verified ? <StatusChip label="Verified" tone="live" /> : null}
      </View>
    </View>
  );
}

export function ProfileScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const authQ = useAuthProfile();
  const userQ = useUserProfile();

  useEffect(() => {
    analytics.screen('S-701');
  }, []);

  const p = authQ.data ?? userQ.data;
  const name = p?.first_name ?? p?.username ?? 'User';

  return (
    <ScreenLayout testID="S-701">
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: theme.spacing.pageY }}>
        <ExchangeCard elevated style={{ marginBottom: theme.spacing[3.5] }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing[3.5], alignItems: 'center' }}>
            <Avatar name={name} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={[theme.typography.headingLg, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{name}</Text>
              <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                Profile & identifiers
              </Text>
            </View>
          </View>
        </ExchangeCard>

        <ExchangeCard variant="terminal" padded={false} style={{ marginBottom: theme.spacing[2] }}>
          <Field label="Email" value={p?.email ?? '—'} />
          <Field label="Phone" value={p?.phone ?? '—'} verified={!!p?.phone_verified} />
          <Field label="Username" value={p?.username ?? '—'} />
          <Field label="Referral code" value={p?.referral_code ?? '—'} />
          <Field label="KYC status" value={p?.kyc_status ?? '—'} />
        </ExchangeCard>

        <AccountMenuRow icon="create-outline" label="Edit avatar" onPress={() => navigation.navigate('AvatarEdit')} />
      </ScrollView>
    </ScreenLayout>
  );
}
