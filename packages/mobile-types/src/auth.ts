export type AuthUser = {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  status: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  tierLevel: number;
  referralCode?: string | null;
  twoFaEnabled?: boolean;
  countryCode?: string | null;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

export type AuthSessionResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  isNewUser?: boolean;
};

export type SendOtpRequest = {
  identifier: string;
  type?: 'email' | 'phone';
  purpose?: 'login' | 'signup';
  captchaToken?: string;
};

export type SendOtpResponse = {
  type: 'email' | 'phone';
  expiresAt: string;
  isNewUser?: boolean;
  maskedIdentifier?: string;
};

export type VerifyOtpRequest = {
  identifier: string;
  otp: string;
  type?: 'email' | 'phone';
  purpose?: 'login' | 'signup';
};

export type VerifyOtpSignupResponse = {
  verified: boolean;
  type: 'email' | 'phone';
  message: string;
};

export type LoginPasswordRequest = {
  email: string;
  password: string;
};

export type LoginOtpRequest = {
  email?: string;
  phone?: string;
  otp: string;
};

export type LoginStepResponse =
  | AuthSessionResponse
  | {
      requiresVerification: true;
      verificationToken: string;
      stepsRequired: Array<'sms' | 'email' | '2fa'>;
      currentStep: number;
      nextStep: 'sms' | 'email' | '2fa';
      maskedPhone?: string;
      maskedEmail?: string;
    };

export type LoginVerifyStepRequest = {
  verificationToken: string;
  step: 'sms' | 'email' | '2fa';
  code: string;
};

export type SignupRequest = {
  email?: string;
  phone?: string;
  password: string;
  referralCode?: string;
};

export type PasswordResetRequest = {
  identifier: string;
};

export type PasswordResetConfirm = {
  identifier: string;
  otp: string;
  newPassword: string;
};

export type CaptchaConfig = {
  enabled: boolean;
  siteKey?: string;
  provider?: string;
};

export type OAuthUrlResponse = {
  url: string;
  state: string;
};

export type PasskeyAvailableResponse = {
  available: boolean;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken: string;
};

export type WithdrawalAddress = {
  id: string;
  asset: string;
  network?: string;
  note?: string;
  address: string;
  memo?: string;
  is_whitelisted?: boolean;
  last_updated?: string;
};

export type WithdrawalAddressInput = {
  asset: string;
  network?: string;
  address: string;
  note?: string;
  memo?: string;
};

export type WhitelistStatus = {
  enabled: boolean;
};

export type TwoFAStatus = {
  enabled: boolean;
};

export type FundPasswordStatus = {
  enabled: boolean;
  isSet?: boolean;
};

export type NewAddressLockStatus = {
  enabled: boolean;
  lockHours?: number;
};
