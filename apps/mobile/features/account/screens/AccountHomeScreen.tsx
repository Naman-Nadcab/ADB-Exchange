import { useEffect } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useAuthProfile, useNotifications, useKycStatus } from '../hooks/useAccount';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';
import type { UserNotification } from '@exchange/mobile-types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountHome'>;

export function AccountHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const profileQ = useAuthProfile();
  const notifQ = useNotifications();
  const kycQ = useKycStatus();

  useEffect(() => {
    analytics.screen('S-700');
  }, []);

  const unread = (notifQ.data ?? []).filter((n: UserNotification) => !n.read).length;
  const p = profileQ.data;

  return (
    <ScreenLayout testID="S-700">
      <ScrollView>
        <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
          {p?.first_name ?? user?.username ?? user?.email ?? 'Account'}
        </Text>
        <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 16 }}>
          Tier {p?.tier_level ?? user?.tierLevel ?? 0} · KYC {kycQ.data?.status ?? p?.kyc_status ?? '—'}
        </Text>
        <AccountMenuRow label="Profile & identifiers" onPress={() => navigation.navigate('Profile')} />
        <AccountMenuRow label="Security Center" onPress={() => navigation.navigate('SecurityCenter')} />
        <AccountMenuRow label="Identity Verification (KYC)" sub={kycQ.data?.status} onPress={() => navigation.navigate('KYCHub')} />
        <AccountMenuRow label="Notifications" badge={unread || undefined} onPress={() => navigation.navigate('Notifications')} />
        <AccountMenuRow label="Preferences & Settings" onPress={() => navigation.navigate('Preferences')} />
        <AccountMenuRow label="Referral Program" onPress={() => navigation.navigate('ReferralHome')} />
        <AccountMenuRow label="API Keys" onPress={() => navigation.navigate('ApiKeys')} />
        <AccountMenuRow label="Help & FAQ" onPress={() => navigation.navigate('HelpFaq')} />
        <AccountMenuRow label="Support Tickets" onPress={() => navigation.navigate('SupportTickets')} />
        <AccountMenuRow label="Fee Tier & VIP" onPress={() => navigation.navigate('FeeTier')} />
        <AccountMenuRow label="About & Legal" onPress={() => navigation.navigate('About')} />
        <AccountMenuRow label="System Status" onPress={() => navigation.navigate('SystemStatus')} />
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', marginBottom: 4 },
});
