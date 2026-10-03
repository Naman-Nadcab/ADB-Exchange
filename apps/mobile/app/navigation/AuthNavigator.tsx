import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { AuthStackParamList } from './types';
import {
  WelcomeScreen,
  LoginMethodScreen,
  LoginIdentifierScreen,
  LoginPasswordScreen,
  LoginOtpScreen,
  LoginVerifyStepScreen,
  LoginPasskeyScreen,
  LoginWalletScreen,
  SignupIdentifierScreen,
  SignupOtpScreen,
  SignupPasswordScreen,
  SignupReferralScreen,
  ForgotPasswordRequestScreen,
  ForgotPasswordOtpScreen,
  ForgotPasswordNewScreen,
  OAuthCallbackScreen,
} from '@features/auth';
import {
  getAuthPreviewParams,
  getAuthPreviewScreen,
  isAuthPreviewEnabled,
} from '@app/bootstrap/authPreview';

const Stack = createNativeStackNavigator<AuthStackParamList>();

function previewParams<T extends keyof AuthStackParamList>(
  screen: T,
): AuthStackParamList[T] | undefined {
  if (!isAuthPreviewEnabled() || getAuthPreviewScreen() !== screen) return undefined;
  return getAuthPreviewParams() as AuthStackParamList[T];
}

export function AuthNavigator() {
  const previewScreen = isAuthPreviewEnabled() ? getAuthPreviewScreen() : null;
  const initialRouteName = (previewScreen ?? 'Welcome') as keyof AuthStackParamList;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="LoginMethod" component={LoginMethodScreen} />
      <Stack.Screen name="LoginIdentifier" component={LoginIdentifierScreen} />
      <Stack.Screen
        name="LoginPassword"
        component={LoginPasswordScreen}
        initialParams={previewParams('LoginPassword')}
      />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} initialParams={previewParams('LoginOtp')} />
      <Stack.Screen
        name="LoginVerifyStep"
        component={LoginVerifyStepScreen}
        initialParams={previewParams('LoginVerifyStep')}
      />
      <Stack.Screen
        name="LoginPasskey"
        component={LoginPasskeyScreen}
        initialParams={previewParams('LoginPasskey')}
      />
      <Stack.Screen
        name="LoginWallet"
        component={LoginWalletScreen}
        initialParams={previewParams('LoginWallet')}
      />
      <Stack.Screen
        name="SignupIdentifier"
        component={SignupIdentifierScreen}
        initialParams={previewParams('SignupIdentifier')}
      />
      <Stack.Screen name="SignupOtp" component={SignupOtpScreen} initialParams={previewParams('SignupOtp')} />
      <Stack.Screen
        name="SignupPassword"
        component={SignupPasswordScreen}
        initialParams={previewParams('SignupPassword')}
      />
      <Stack.Screen
        name="SignupReferral"
        component={SignupReferralScreen}
        initialParams={previewParams('SignupReferral')}
      />
      <Stack.Screen name="ForgotPasswordRequest" component={ForgotPasswordRequestScreen} />
      <Stack.Screen
        name="ForgotPasswordOtp"
        component={ForgotPasswordOtpScreen}
        initialParams={previewParams('ForgotPasswordOtp')}
      />
      <Stack.Screen
        name="ForgotPasswordNew"
        component={ForgotPasswordNewScreen}
        initialParams={previewParams('ForgotPasswordNew')}
      />
      <Stack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </Stack.Navigator>
  );
}
