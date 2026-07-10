import { createNativeStackNavigator } from '@react-navigation/native-stack';
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

const Stack = createNativeStackNavigator<AccountStackParamList>();

export function AccountStackNavigator() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="AccountHome" component={AccountHomeScreen} options={{ title: 'Account' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="AvatarEdit" component={AvatarEditScreen} options={{ title: 'Avatar' }} />
      <Stack.Screen name="SecurityCenter" component={SecurityCenterScreen} options={{ title: 'Security' }} />
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} options={{ title: 'Password' }} />
      <Stack.Screen name="TwoFA" component={TwoFAScreen} options={{ title: '2FA' }} />
      <Stack.Screen name="Passkeys" component={PasskeysScreen} options={{ title: 'Passkeys' }} />
      <Stack.Screen name="FundPassword" component={FundPasswordScreen} options={{ title: 'Fund Password' }} />
      <Stack.Screen name="AntiPhishing" component={AntiPhishingScreen} options={{ title: 'Anti-Phishing' }} />
      <Stack.Screen name="Sessions" component={SessionsScreen} options={{ title: 'Sessions' }} />
      <Stack.Screen name="LoginHistory" component={LoginHistoryScreen} options={{ title: 'Login History' }} />
      <Stack.Screen name="WithdrawalLimits" component={WithdrawalLimitsScreen} options={{ title: 'Limits' }} />
      <Stack.Screen name="Whitelist" component={WhitelistScreen} options={{ title: 'Whitelist' }} />
      <Stack.Screen name="AppLockSettings" component={AppLockSettingsScreen} options={{ title: 'App Lock' }} />
      <Stack.Screen name="KYCHub" component={KYCHubScreen} options={{ title: 'KYC' }} />
      <Stack.Screen name="KYCDocument" component={KYCDocumentScreen} options={{ title: 'Verify Identity' }} />
      <Stack.Screen name="KYCResult" component={KYCResultScreen} options={{ title: 'KYC Result' }} />
      <Stack.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'Settings' }} />
      <Stack.Screen name="FeeTier" component={FeeTierScreen} options={{ title: 'Fee Tier' }} />
      <Stack.Screen name="ReferralHome" component={ReferralHomeScreen} options={{ title: 'Referral' }} />
      <Stack.Screen name="ReferralList" component={ReferralListScreen} options={{ title: 'Referrals' }} />
      <Stack.Screen name="ReferralShare" component={ReferralShareScreen} options={{ title: 'Share' }} />
      <Stack.Screen name="ApiKeys" component={ApiKeysScreen} options={{ title: 'API Keys' }} />
      <Stack.Screen name="CreateApiKey" component={CreateApiKeyScreen} options={{ title: 'Create Key' }} />
      <Stack.Screen name="ApiKeyDetail" component={ApiKeyDetailScreen} options={{ title: 'API Key' }} />
      <Stack.Screen name="HelpFaq" component={HelpFaqScreen} options={{ title: 'Help' }} />
      <Stack.Screen name="SupportTickets" component={SupportTicketsScreen} options={{ title: 'Support' }} />
      <Stack.Screen name="CreateTicket" component={CreateTicketScreen} options={{ title: 'New Ticket' }} />
      <Stack.Screen name="TicketDetail" component={TicketDetailScreen} options={{ title: 'Ticket' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <Stack.Screen name="NotificationDetail" component={NotificationDetailScreen} options={{ title: 'Notification' }} />
      <Stack.Screen name="About" component={AboutScreen} options={{ title: 'About' }} />
      <Stack.Screen name="SystemStatus" component={SystemStatusScreen} options={{ title: 'Status' }} />
      <Stack.Screen name="LegalViewer" component={LegalViewerScreen} options={{ title: 'Legal' }} />
      <Stack.Screen name="AccountDeletion" component={AccountDeletionScreen} options={{ title: 'Delete Account' }} />
    </Stack.Navigator>
  );
}
