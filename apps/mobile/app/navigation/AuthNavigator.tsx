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
  SignupIdentifierScreen,
  SignupOtpScreen,
  SignupPasswordScreen,
  SignupReferralScreen,
  ForgotPasswordRequestScreen,
  ForgotPasswordOtpScreen,
  ForgotPasswordNewScreen,
  OAuthCallbackScreen,
} from '@features/auth';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName="Welcome">
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="LoginMethod" component={LoginMethodScreen} />
      <Stack.Screen name="LoginIdentifier" component={LoginIdentifierScreen} />
      <Stack.Screen name="LoginPassword" component={LoginPasswordScreen} />
      <Stack.Screen name="LoginOtp" component={LoginOtpScreen} />
      <Stack.Screen name="LoginVerifyStep" component={LoginVerifyStepScreen} />
      <Stack.Screen name="LoginPasskey" component={LoginPasskeyScreen} />
      <Stack.Screen name="SignupIdentifier" component={SignupIdentifierScreen} />
      <Stack.Screen name="SignupOtp" component={SignupOtpScreen} />
      <Stack.Screen name="SignupPassword" component={SignupPasswordScreen} />
      <Stack.Screen name="SignupReferral" component={SignupReferralScreen} />
      <Stack.Screen name="ForgotPasswordRequest" component={ForgotPasswordRequestScreen} />
      <Stack.Screen name="ForgotPasswordOtp" component={ForgotPasswordOtpScreen} />
      <Stack.Screen name="ForgotPasswordNew" component={ForgotPasswordNewScreen} />
      <Stack.Screen name="OAuthCallback" component={OAuthCallbackScreen} />
    </Stack.Navigator>
  );
}
