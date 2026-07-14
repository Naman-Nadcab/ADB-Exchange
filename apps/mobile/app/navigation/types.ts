export type AuthStackParamList = {
  Welcome: undefined;
  LoginMethod: undefined;
  LoginIdentifier: undefined;
  LoginPassword: undefined;
  LoginOtp: { identifier: string };
  LoginVerifyStep: {
    verificationToken: string;
    nextStep: 'sms' | 'email' | '2fa';
  };
  LoginPasskey: undefined;
  SignupIdentifier: { referralCode?: string; idType?: 'email' | 'phone' } | undefined;
  SignupOtp: { identifier: string; referralCode?: string };
  SignupPassword: { identifier: string; referralCode?: string };
  SignupReferral: { identifier: string; password: string };
  ForgotPasswordRequest: undefined;
  ForgotPasswordOtp: { identifier: string };
  ForgotPasswordNew: { identifier: string; otp: string };
  OAuthCallback: { provider: 'google' | 'apple'; code: string; state: string };
};

export type OnboardingStackParamList = {
  EnableBiometrics: undefined;
  PinFallback: undefined;
};

export type MainTabParamList = {
  Markets: undefined;
  Trade: { symbol?: string } | undefined;
  Orders: undefined;
  Wallet: undefined;
  P2P: undefined;
};

export type RootStackParamList = {
  Splash: undefined;
  Auth: undefined;
  Onboarding: undefined;
  Main: undefined;
  Account: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
