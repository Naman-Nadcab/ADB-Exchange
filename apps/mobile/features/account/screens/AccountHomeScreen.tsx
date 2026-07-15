import { useEffect } from 'react';
import { ScrollView, Text, StyleSheet, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, ExchangeCard, Avatar, PrimaryButton } from '@shared/ui';
import { useTheme, hapticSelection, marketing } from '@shared/theme';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useAuthProfile, useNotifications, useKycStatus } from '../hooks/useAccount';
import { useAuthActions, useGuestAccess } from '@features/auth';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountHome'>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>{title}</Text>
      <ExchangeCard variant="terminal" style={styles.sectionCard}>
        <View style={styles.sectionInner}>{children}</View>
      </ExchangeCard>
    </View>
  );
}

export function AccountHomeScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const user = useAuthStore((s) => s.user);
  const profileQ = useAuthProfile();
  const notifQ = useNotifications();
  const kycQ = useKycStatus();
  const { logout } = useAuthActions();
  const { isGuest, openLogin, openSignup, requireAuth } = useGuestAccess();

  useEffect(() => {
    analytics.screen('S-700');
  }, []);

  const unread = (notifQ.data ?? []).filter((n) => !n.read).length;
  const p = profileQ.data;
  const displayName = p?.first_name ?? user?.username ?? user?.email ?? 'Guest';

  const guardedNav = (action: () => void) => {
    if (!requireAuth()) return;
    action();
  };

  return (
    <ScreenLayout testID="S-700" style={{ backgroundColor: marketing.pageBg }}>
      <View style={styles.modalHeader}>
        <Pressable
          onPress={() => {
            void hapticSelection();
            navigation.getParent()?.goBack();
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close account"
        >
          <Ionicons name="close" size={24} color={`hsl(${theme.colors.foregroundPrimary})`} />
        </Pressable>
        <Text style={[styles.modalTitle, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Account</Text>
        <View style={styles.modalSpacer} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ExchangeCard elevated style={styles.hero}>
          <View style={styles.heroRow}>
            <Avatar name={displayName} size="lg" />
            <View style={styles.heroMeta}>
              <Text style={[styles.heroName, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
                {isGuest ? 'Guest' : displayName}
              </Text>
              <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 13 }}>
                {isGuest ? 'Browse markets · Sign in for full access' : user?.email ?? user?.phone ?? '—'}
              </Text>
              {!isGuest ? (
                <View style={styles.badges}>
                  <View style={[styles.tierBadge, { backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)` }]}>
                    <Ionicons name="diamond-outline" size={12} color={`hsl(${theme.colors.brandPrimary})`} />
                    <Text style={{ color: `hsl(${theme.colors.brandPrimary})`, fontWeight: '700', fontSize: 11 }}>
                      VIP {p?.tier_level ?? user?.tierLevel ?? 0}
                    </Text>
                  </View>
                  <View style={[styles.kycBadge, { borderColor: `hsl(${theme.colors.borderDefault})` }]}>
                    <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, fontSize: 11, fontWeight: '600' }}>
                      KYC {kycQ.data?.status ?? p?.kyc_status ?? '—'}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          </View>
        </ExchangeCard>

        {isGuest ? (
          <View style={{ gap: 12, marginBottom: 16 }}>
            <PrimaryButton title="Log In" size="xl" onPress={() => openLogin()} />
            <PrimaryButton title="Register" variant="outline" size="xl" onPress={() => openSignup()} />
          </View>
        ) : null}

        {!isGuest ? (
          <Section title="ACCOUNT">
            <AccountMenuRow icon="person-outline" label="Profile & identifiers" onPress={() => navigation.navigate('Profile')} />
            <AccountMenuRow icon="shield-checkmark-outline" label="Security Center" onPress={() => navigation.navigate('SecurityCenter')} />
            <AccountMenuRow icon="document-text-outline" label="Identity Verification" sub={kycQ.data?.status} onPress={() => navigation.navigate('KYCHub')} />
            <AccountMenuRow icon="notifications-outline" label="Notifications" badge={unread || undefined} onPress={() => navigation.navigate('Notifications')} />
          </Section>
        ) : null}

        <Section title="PREFERENCES">
          <AccountMenuRow icon="settings-outline" label="Language & Theme" onPress={() => navigation.navigate('Preferences')} />
          {!isGuest ? (
            <>
              <AccountMenuRow icon="gift-outline" label="Referral Program" onPress={() => guardedNav(() => navigation.navigate('ReferralHome'))} />
              <AccountMenuRow icon="key-outline" label="API Keys" onPress={() => guardedNav(() => navigation.navigate('ApiKeys'))} />
            </>
          ) : null}
        </Section>

        <Section title="SUPPORT">
          <AccountMenuRow icon="megaphone-outline" label="Announcements" sub="Platform updates" onPress={() => navigation.navigate('Announcements')} />
          <AccountMenuRow icon="download-outline" label="Data Export" sub="CSV activity exports" onPress={() => guardedNav(() => navigation.navigate('DataExport'))} />
          <AccountMenuRow icon="help-circle-outline" label="Help & FAQ" onPress={() => navigation.navigate('HelpFaq')} />
          <AccountMenuRow icon="chatbubbles-outline" label="Support Tickets" onPress={() => guardedNav(() => navigation.navigate('SupportTickets'))} />
          <AccountMenuRow icon="ribbon-outline" label="Fee Tier & VIP" onPress={() => navigation.navigate('FeeTier')} />
          <AccountMenuRow icon="information-circle-outline" label="About & Legal" onPress={() => navigation.navigate('About')} />
          <AccountMenuRow icon="document-text-outline" label="Terms of Service" onPress={() => navigation.navigate('LegalViewer', { doc: 'terms' })} />
          <AccountMenuRow icon="shield-outline" label="Privacy Policy" onPress={() => navigation.navigate('LegalViewer', { doc: 'privacy' })} />
          <AccountMenuRow icon="pulse-outline" label="System Status" onPress={() => navigation.navigate('SystemStatus')} />
        </Section>

        {!isGuest ? (
          <ExchangeCard elevated style={{ marginTop: 8, marginBottom: 24 }}>
            <AccountMenuRow
              icon="log-out-outline"
              label="Log out"
              onPress={() => {
                navigation.getParent()?.goBack();
                void logout();
              }}
            />
          </ExchangeCard>
        ) : null}
      </ScrollView>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 44,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalSpacer: { width: 24 },
  hero: { marginBottom: 16 },
  heroRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  heroMeta: { flex: 1 },
  heroName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  badges: { flexDirection: 'row', gap: 8, marginTop: 8 },
  tierBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  kycBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, marginLeft: 4 },
  sectionCard: { paddingVertical: 0, paddingHorizontal: 0 },
  sectionInner: { paddingVertical: 4 },
});
