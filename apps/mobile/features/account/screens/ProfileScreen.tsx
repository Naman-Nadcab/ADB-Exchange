import { useEffect } from 'react';
import { ScrollView, Text, View, StyleSheet } from 'react-native';
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
    <View style={[styles.field, { borderBottomColor: `hsl(${theme.colors.borderDefault})` }]}>
      <Text style={[styles.fieldLabel, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{label}</Text>
      <View style={styles.fieldValueRow}>
        <Text style={[styles.fieldValue, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{value}</Text>
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
      <ScrollView showsVerticalScrollIndicator={false}>
        <ExchangeCard elevated style={styles.hero}>
          <View style={styles.heroRow}>
            <Avatar name={name} size="lg" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.heroName, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>{name}</Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
                Profile & identifiers
              </Text>
            </View>
          </View>
        </ExchangeCard>

        <ExchangeCard variant="terminal" style={styles.card}>
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

const styles = StyleSheet.create({
  hero: { marginBottom: 14 },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  heroName: { fontSize: 20, fontWeight: '700' },
  card: { marginBottom: 8, paddingVertical: 0, paddingHorizontal: 0 },
  field: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 },
  fieldValue: { fontSize: 15, fontWeight: '600' },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
});
