import { useEffect } from 'react';
import { ScrollView, Text, View, Pressable } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenLayout, ExchangeCard, Avatar, PrimaryButton, StatusChip } from '@shared/ui';
import { useTheme, hapticSelection } from '@shared/theme';
import type { StatusChipTone } from '@shared/theme/statusPalettes';
import { analytics } from '@core/observability/analytics';
import { useAuthStore } from '@core/state/authStore';
import { useAuthProfile, useNotifications, useKycStatus } from '../hooks/useAccount';
import { useAuthActions, useGuestAccess } from '@features/auth';
import { AccountMenuRow } from '../components/AccountMenuRow';
import type { AccountStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<AccountStackParamList, 'AccountHome'>;

function kycStatusTone(status?: string): StatusChipTone {
  const s = (status ?? '').toLowerCase();
  if (s.includes('approved') || s.includes('verified')) return 'live';
  if (s.includes('reject')) return 'off';
  if (s.includes('pending') || s.includes('review')) return 'sync';
  return 'neutral';
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={{ marginBottom: theme.spacing[4] }}>
      <Text
        style={[
          theme.typography.labelSm,
          {
            color: `hsl(${theme.colors.foregroundSecondary})`,
            fontFamily: theme.fonts.sansBold,
            letterSpacing: 1.2,
            marginBottom: theme.spacing[2],
            marginLeft: theme.spacing[1],
            textTransform: 'uppercase',
          },
        ]}
      >
        {title}
      </Text>
      <ExchangeCard variant="terminal" style={{ paddingVertical: 0, paddingHorizontal: 0 }}>
        <View style={{ paddingVertical: theme.spacing[1] }}>{children}</View>
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
  const kycStatus = kycQ.data?.status ?? p?.kyc_status;

  const guardedNav = (action: () => void) => {
    if (!requireAuth()) return;
    action();
  };

  return (
    <ScreenLayout testID="S-700" style={{ backgroundColor: theme.marketing.pageBg }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: theme.spacing[3],
          minHeight: theme.sizes.tapTarget,
        }}
      >
        <Pressable
          onPress={() => {
            void hapticSelection();
            navigation.getParent()?.goBack();
          }}
          hitSlop={theme.spacing[3]}
          accessibilityRole="button"
          accessibilityLabel="Close account"
        >
          <Ionicons name="close" size={theme.sizes.iconMd} color={`hsl(${theme.colors.foregroundPrimary})`} />
        </Pressable>
        <Text style={[theme.typography.headingMd, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Account</Text>
        <View style={{ width: theme.sizes.iconMd }} />
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        <ExchangeCard elevated style={{ marginBottom: theme.spacing[4] }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing[3.5], alignItems: 'center' }}>
            <Avatar name={displayName} size="lg" />
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  theme.typography.headingMd,
                  { color: `hsl(${theme.colors.foregroundPrimary})`, marginBottom: theme.spacing[0.5] },
                ]}
              >
                {isGuest ? 'Guest' : displayName}
              </Text>
              <Text style={[theme.typography.bodyMd, { color: `hsl(${theme.colors.foregroundSecondary})` }]}>
                {isGuest ? 'Browse markets · Sign in for full access' : user?.email ?? user?.phone ?? '—'}
              </Text>
              {!isGuest ? (
                <View style={{ flexDirection: 'row', gap: theme.spacing[2], marginTop: theme.spacing[2], flexWrap: 'wrap' }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: theme.spacing[1],
                      paddingHorizontal: theme.spacing[2],
                      paddingVertical: theme.spacing[1],
                      borderRadius: theme.radius.full,
                      backgroundColor: `hsl(${theme.colors.brandPrimary} / 0.14)`,
                    }}
                  >
                    <Ionicons name="diamond-outline" size={theme.sizes.iconXs - 4} color={`hsl(${theme.colors.brandPrimary})`} />
                    <Text
                      style={[
                        theme.typography.labelSm,
                        { color: `hsl(${theme.colors.brandPrimary})`, fontFamily: theme.fonts.sansBold },
                      ]}
                    >
                      VIP {p?.tier_level ?? user?.tierLevel ?? 0}
                    </Text>
                  </View>
                  {kycStatus ? (
                    <StatusChip label={`KYC ${kycStatus}`} tone={kycStatusTone(kycStatus)} />
                  ) : null}
                </View>
              ) : null}
            </View>
          </View>
        </ExchangeCard>

        {isGuest ? (
          <View style={{ gap: theme.spacing[3], marginBottom: theme.spacing[4] }}>
            <PrimaryButton title="Log In" size="xl" onPress={() => openLogin()} />
            <PrimaryButton title="Register" variant="outline" size="xl" onPress={() => openSignup()} />
          </View>
        ) : null}

        {!isGuest ? (
          <Section title="ACCOUNT">
            <AccountMenuRow icon="person-outline" label="Profile & identifiers" onPress={() => navigation.navigate('Profile')} />
            <AccountMenuRow icon="shield-checkmark-outline" label="Security Center" onPress={() => navigation.navigate('SecurityCenter')} />
            <AccountMenuRow icon="document-text-outline" label="Identity Verification" sub={kycStatus} onPress={() => navigation.navigate('KYCHub')} />
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
          <ExchangeCard elevated style={{ marginTop: theme.spacing[2], marginBottom: theme.spacing.pageY }}>
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
