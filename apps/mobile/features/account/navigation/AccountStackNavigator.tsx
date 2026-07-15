import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { guestGuard } from '@features/auth';
import { AccountHomeScreen } from '../screens/AccountHomeScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AvatarEditScreen } from '../screens/AvatarEditScreen';
import { SecurityCenterScreen } from '../screens/SecurityCenterScreen';
import { ChangePasswordScreen } from '../screens/ChangePasswordScreen';
import { TwoFAScreen } from '../screens/TwoFAScreen';
import { PasskeysScreen } from '../screens/PasskeysScreen';
import { FundPasswordScreen } from '../screens/FundPasswordScreen';
import { AntiPhishingScreen } from '../screens/AntiPhishingScreen';
import { SessionsScreen } from '../screens/SessionsScreen';
import { LoginHistoryScreen } from '../screens/LoginHistoryScreen';
import { WithdrawalLimitsScreen } from '../screens/WithdrawalLimitsScreen';
import { WhitelistScreen } from '../screens/WhitelistScreen';
import { AppLockSettingsScreen } from '../screens/AppLockSettingsScreen';
import { KYCHubScreen } from '../screens/KYCHubScreen';
import { KYCDocumentScreen } from '../screens/KYCDocumentScreen';
import { KYCResultScreen } from '../screens/KYCResultScreen';
import { PreferencesScreen } from '../screens/PreferencesScreen';
import { FeeTierScreen } from '../screens/FeeTierScreen';
import { ReferralHomeScreen } from '../screens/ReferralHomeScreen';
import { ReferralListScreen } from '../screens/ReferralListScreen';
import { ReferralShareScreen } from '../screens/ReferralShareScreen';
import { ApiKeysScreen } from '../screens/ApiKeysScreen';
import { CreateApiKeyScreen } from '../screens/CreateApiKeyScreen';
import { ApiKeyDetailScreen } from '../screens/ApiKeyDetailScreen';
import { HelpFaqScreen } from '../screens/HelpFaqScreen';
import { SupportTicketsScreen } from '../screens/SupportTicketsScreen';
import { CreateTicketScreen } from '../screens/CreateTicketScreen';
import { TicketDetailScreen } from '../screens/TicketDetailScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { NotificationDetailScreen } from '../screens/NotificationDetailScreen';
import { AboutScreen } from '../screens/AboutScreen';
import { SystemStatusScreen } from '../screens/SystemStatusScreen';
import { LegalViewerScreen } from '../screens/LegalViewerScreen';
import { AccountDeletionScreen } from '../screens/AccountDeletionScreen';
import type { AccountStackParamList } from './types';
import { exchangeStackScreenOptions } from '@app/navigation/navigationTheme';

const Stack = createNativeStackNavigator<AccountStackParamList>();

export function AccountStackNavigator() {
  return (
    <Stack.Navigator screenOptions={exchangeStackScreenOptions}>
      <Stack.Screen name="AccountHome" component={AccountHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Profile" component={guestGuard(ProfileScreen, 'Log in to view your profile.')} options={{ title: 'Profile' }} />
      <Stack.Screen name="AvatarEdit" component={guestGuard(AvatarEditScreen, 'Log in to edit your avatar.')} options={{ title: 'Avatar' }} />
      <Stack.Screen name="SecurityCenter" component={guestGuard(SecurityCenterScreen, 'Log in to manage security settings.')} options={{ title: 'Security' }} />
      <Stack.Screen name="ChangePassword" component={guestGuard(ChangePasswordScreen, 'Log in to change your password.')} options={{ title: 'Password' }} />
      <Stack.Screen name="TwoFA" component={guestGuard(TwoFAScreen, 'Log in to manage 2FA.')} options={{ title: '2FA' }} />
      <Stack.Screen name="Passkeys" component={guestGuard(PasskeysScreen, 'Log in to manage passkeys.')} options={{ title: 'Passkeys' }} />
      <Stack.Screen name="FundPassword" component={guestGuard(FundPasswordScreen, 'Log in to manage fund password.')} options={{ title: 'Fund Password' }} />
      <Stack.Screen name="AntiPhishing" component={guestGuard(AntiPhishingScreen, 'Log in to manage anti-phishing code.')} options={{ title: 'Anti-Phishing' }} />
      <Stack.Screen name="Sessions" component={guestGuard(SessionsScreen, 'Log in to view active sessions.')} options={{ title: 'Sessions' }} />
      <Stack.Screen name="LoginHistory" component={guestGuard(LoginHistoryScreen, 'Log in to view login history.')} options={{ title: 'Login History' }} />
      <Stack.Screen name="WithdrawalLimits" component={guestGuard(WithdrawalLimitsScreen, 'Log in to view withdrawal limits.')} options={{ title: 'Limits' }} />
      <Stack.Screen name="Whitelist" component={guestGuard(WhitelistScreen, 'Log in to manage whitelist.')} options={{ title: 'Whitelist' }} />
      <Stack.Screen name="AppLockSettings" component={guestGuard(AppLockSettingsScreen, 'Log in to manage app lock.')} options={{ title: 'App Lock' }} />
      <Stack.Screen name="KYCHub" component={guestGuard(KYCHubScreen, 'Log in to complete KYC.')} options={{ title: 'KYC' }} />
      <Stack.Screen name="KYCDocument" component={guestGuard(KYCDocumentScreen, 'Log in to submit KYC documents.')} options={{ title: 'Verify Identity' }} />
      <Stack.Screen name="KYCResult" component={guestGuard(KYCResultScreen, 'Log in to view KYC status.')} options={{ title: 'KYC Result' }} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="FeeTier" component={FeeTierScreen} options={{ title: 'Fee Tier' }} />
      <Stack.Screen name="ReferralHome" component={guestGuard(ReferralHomeScreen, 'Log in to access referrals.')} options={{ title: 'Referral' }} />
      <Stack.Screen name="ReferralList" component={guestGuard(ReferralListScreen, 'Log in to view referrals.')} options={{ title: 'Referrals' }} />
      <Stack.Screen name="ReferralShare" component={guestGuard(ReferralShareScreen, 'Log in to share referral link.')} options={{ title: 'Share' }} />
      <Stack.Screen name="ApiKeys" component={guestGuard(ApiKeysScreen, 'Log in to manage API keys.')} options={{ title: 'API Keys' }} />
      <Stack.Screen name="CreateApiKey" component={guestGuard(CreateApiKeyScreen, 'Log in to create API keys.')} options={{ title: 'Create Key' }} />
      <Stack.Screen name="ApiKeyDetail" component={guestGuard(ApiKeyDetailScreen, 'Log in to view API key details.')} options={{ title: 'API Key' }} />
      <Stack.Screen name="HelpFaq" component={HelpFaqScreen} options={{ title: 'Help' }} />
      <Stack.Screen name="SupportTickets" component={guestGuard(SupportTicketsScreen, 'Log in to view support tickets.')} options={{ title: 'Support' }} />
      <Stack.Screen name="CreateTicket" component={guestGuard(CreateTicketScreen, 'Log in to create a support ticket.')} options={{ title: 'New Ticket' }} />
      <Stack.Screen name="TicketDetail" component={guestGuard(TicketDetailScreen, 'Log in to view ticket details.')} options={{ title: 'Ticket' }} />
      <Stack.Screen name="Notifications" component={guestGuard(NotificationsScreen, 'Log in to view notifications.')} options={{ title: 'Notifications' }} />
      <Stack.Screen name="NotificationDetail" component={guestGuard(NotificationDetailScreen, 'Log in to view notification details.')} options={{ title: 'Notification' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      <Stack.Screen name="SystemStatus" component={SystemStatusScreen} options={{ title: 'Status' }} />
      <Stack.Screen name="LegalViewer" component={LegalViewerScreen} options={{ title: 'Legal' }} />
      <Stack.Screen name="AccountDeletion" component={guestGuard(AccountDeletionScreen, 'Log in to delete your account.')} options={{ title: 'Delete Account' }} />
    </Stack.Navigator>
  );
}
