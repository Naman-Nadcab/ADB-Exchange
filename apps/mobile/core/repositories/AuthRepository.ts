import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import { ApiError } from '../api/errors/ApiError';
import { walletChallengeRequestBody, walletLoginRequestBody } from '@core/wallet-auth/sessionBoundary';
import type {
  AuthSessionResponse,
  CaptchaConfig,
  LoginOtpRequest,
  LoginPasswordRequest,
  LoginStepResponse,
  LoginVerifyStepRequest,
  OAuthUrlResponse,
  PasskeyAvailableResponse,
  PasswordResetConfirm,
  PasswordResetRequest,
  RefreshResponse,
  SendOtpRequest,
  SendOtpResponse,
  SignupRequest,
  VerifyOtpRequest,
  VerifyOtpSignupResponse,
  AuthUser,
  WithdrawalAddress,
  WithdrawalAddressInput,
  WhitelistStatus,
  TwoFAStatus,
  FundPasswordStatus,
  NewAddressLockStatus,
} from '@exchange/mobile-types';

export class AuthRepository extends BaseRepository {
  getCaptchaConfig() {
    return this.get<CaptchaConfig>('/auth/captcha-config', { skipAuth: true });
  }

  sendOtp(body: SendOtpRequest) {
    return this.post<SendOtpResponse>('/auth/send-otp', body, { skipAuth: true });
  }

  verifyOtp(body: VerifyOtpRequest) {
    return this.post<AuthSessionResponse | VerifyOtpSignupResponse>('/auth/verify-otp', body, {
      skipAuth: true,
    });
  }

  loginPassword(body: LoginPasswordRequest) {
    return this.post<AuthSessionResponse>('/auth/login/password', body, { skipAuth: true });
  }

  loginOtp(body: LoginOtpRequest) {
    return this.post<LoginStepResponse>('/auth/login', body, { skipAuth: true });
  }

  loginVerifyStep(body: LoginVerifyStepRequest) {
    return this.post<LoginStepResponse>('/auth/login/verify-step', body, { skipAuth: true });
  }

  loginResendOtp(body: { verificationToken: string; step?: 'sms' | 'email' }) {
    return this.post<{ success: boolean; message: string }>('/auth/login/resend-otp', body, {
      skipAuth: true,
    });
  }

  signup(body: SignupRequest) {
    return this.post<AuthSessionResponse>('/auth/signup', body, { skipAuth: true });
  }

  refresh(refreshToken: string) {
    return this.post<RefreshResponse>('/auth/refresh', { refreshToken }, { skipAuth: true });
  }

  logout() {
    return this.post<{ message: string }>('/auth/logout', {});
  }

  logoutAllOther() {
    return this.post<{ message: string; revokedCount: number }>('/auth/logout-all-other', {});
  }

  getMe() {
    return this.get<AuthUser>('/auth/me');
  }

  /**
   * POST /auth/wallet/challenge. Body is only the CAIP-10 account.
   * The challenge object is on the envelope, not under data.
   */
  async walletChallenge(caip10: string): Promise<WalletChallengeResult> {
    const envelope = await this.http.request<WalletChallengeEnvelope>('/auth/wallet/challenge', {
      method: 'POST',
      body: walletChallengeRequestBody(caip10),
      skipAuth: true,
      retainEnvelope: true,
    });
    const challenge = envelope.challenge;
    if (!challenge?.id || !challenge.message || !challenge.expiresAt) {
      throw new ApiError('Invalid challenge', 400, 'INVALID_CHALLENGE');
    }
    return {
      id: challenge.id,
      namespace: challenge.namespace ?? '',
      chainReference: challenge.chainReference ?? '',
      address: challenge.address ?? '',
      message: challenge.message,
      nonce: challenge.nonce ?? '',
      expiresAt: challenge.expiresAt,
    };
  }

  /** POST /auth/wallet/login. Opens the existing application session. */
  walletLogin(body: { challengeId: string; message: string; signature: string }) {
    return this.post<AuthSessionResponse>('/auth/wallet/login', walletLoginRequestBody(body), {
      skipAuth: true,
    });
  }

  passwordResetRequest(body: PasswordResetRequest) {
    return this.post<{ message: string; expiresAt?: string }>('/auth/password/reset/request', body, {
      skipAuth: true,
    });
  }

  passwordReset(body: PasswordResetConfirm) {
    return this.post<{ message: string }>('/auth/password/reset', body, { skipAuth: true });
  }

  passkeyAvailable(body: { email?: string; phone?: string }) {
    return this.post<PasskeyAvailableResponse>('/auth/passkey/available', body, { skipAuth: true });
  }

  passkeyAuthenticateOptions(body: { email?: string; phone?: string }) {
    return this.post<Record<string, unknown>>('/auth/passkey/authenticate/options', body, {
      skipAuth: true,
    });
  }

  passkeyAuthenticateVerify(body: { credential: unknown; challenge: string }) {
    return this.post<AuthSessionResponse>('/auth/passkey/authenticate/verify', body, {
      skipAuth: true,
    });
  }

  getGoogleOAuthUrl(redirectUri?: string) {
    const q = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return this.get<OAuthUrlResponse>(`/auth/oauth/google/url${q}`, { skipAuth: true });
  }

  googleOAuthCallback(body: { code: string; state: string; redirect_uri?: string }) {
    return this.post<AuthSessionResponse>('/auth/oauth/google/callback', body, { skipAuth: true });
  }

  getAppleOAuthUrl(redirectUri?: string) {
    const q = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
    return this.get<OAuthUrlResponse>(`/auth/oauth/apple/url${q}`, { skipAuth: true });
  }

  appleOAuthCallback(body: {
    code: string;
    state: string;
    id_token?: string;
    redirect_uri?: string;
  }) {
    return this.post<AuthSessionResponse>('/auth/oauth/apple/callback', body, { skipAuth: true });
  }

  getWithdrawalAddresses() {
    return this.get<{ addresses: WithdrawalAddress[] }>('/auth/withdrawal-addresses').then(
      (r) => r.addresses,
    );
  }

  createWithdrawalAddress(body: WithdrawalAddressInput) {
    return this.post<{ id: string; message: string }>('/auth/withdrawal-addresses', body);
  }

  updateWithdrawalAddress(id: string, body: { note?: string; memo?: string; network?: string }) {
    return this.http.request<{ message: string }>(`/auth/withdrawal-addresses/${id}`, {
      method: 'PATCH',
      body,
    });
  }

  deleteWithdrawalAddress(id: string) {
    return this.http.request<{ message: string }>(`/auth/withdrawal-addresses/${id}`, {
      method: 'DELETE',
    });
  }

  getWhitelistStatus() {
    return this.get<WhitelistStatus>('/auth/withdrawal-whitelist/status');
  }

  getNewAddressLockStatus() {
    return this.get<NewAddressLockStatus>('/auth/new-address-lock/status');
  }

  get2FAStatus() {
    return this.get<TwoFAStatus>('/auth/2fa/status');
  }

  verify2FA(code: string) {
    return this.post<{ valid: boolean }>('/auth/2fa/verify', { code });
  }

  getFundPasswordStatus() {
    return this.get<{ hasFundPassword?: boolean; isSet?: boolean }>('/auth/fund-password/status').then(
      (s) => ({ enabled: !!(s.hasFundPassword ?? s.isSet), isSet: !!(s.hasFundPassword ?? s.isSet) }),
    );
  }

  getProfile() {
    return this.get<import('@exchange/mobile-types').UserProfile>('/auth/profile');
  }

  changePassword(body: { currentPassword: string; newPassword: string; securityOtp?: string }) {
    const { currentPassword, ...rest } = body;
    return this.post<{ message: string }>('/auth/change-password', {
      oldPassword: currentPassword,
      ...rest,
    });
  }

  getPasswordStatus() {
    return this.get<{ hasPassword: boolean }>('/auth/check-password');
  }

  setup2FA() {
    return this.post<{ secret?: string; qrCode?: string }>('/auth/2fa/setup', {});
  }

  enable2FA(code: string) {
    return this.post<{ message: string }>('/auth/2fa/enable', { code });
  }

  disable2FA(code: string) {
    return this.post<{ message: string }>('/auth/2fa/disable', { code });
  }

  getPasskeys() {
    return this.get<{ id: string; name?: string; created_at?: string }[]>('/auth/passkeys');
  }

  renamePasskey(id: string, name: string) {
    return this.post<{ message: string }>(`/auth/passkeys/${id}/rename`, { name });
  }

  deletePasskey(id: string) {
    return this.http.request<{ message: string }>(`/auth/passkeys/${id}`, { method: 'DELETE' });
  }

  setFundPassword(password: string) {
    return this.post<{ message: string }>('/auth/fund-password/set', { password });
  }

  getAntiPhishingStatus() {
    return this.get<{ enabled: boolean; code?: string }>('/auth/anti-phishing/status');
  }

  setAntiPhishing(code: string) {
    return this.post<{ message: string }>('/auth/anti-phishing/set', { code });
  }

  sendSecurityOtp(purpose: string) {
    return this.post<{ message: string }>('/auth/send-security-otp', { purpose });
  }

  verifySecurityOtp(otp: string, purpose: string) {
    return this.post<{ valid: boolean }>('/auth/verify-security-otp', { otp, purpose });
  }

  getPreferences() {
    return this.get<import('@exchange/mobile-types').UserPreferences>('/auth/preferences');
  }

  savePreferences(prefs: import('@exchange/mobile-types').UserPreferences) {
    return this.post<import('@exchange/mobile-types').UserPreferences>('/auth/preferences', prefs);
  }

  getSecuritySettings() {
    return this.get<import('@exchange/mobile-types').SecuritySettings>('/auth/security/settings');
  }

  getWithdrawalLimits() {
    return this.get<Record<string, unknown>>('/auth/withdrawal-limits');
  }

  setWithdrawalLimits(body: Record<string, unknown>) {
    return this.post<Record<string, unknown>>('/auth/withdrawal-limits', body);
  }

  toggleWhitelist(enabled: boolean) {
    return this.post<{ enabled: boolean }>('/auth/withdrawal-whitelist/toggle', { enabled });
  }

  toggleAddressBook(enabled: boolean) {
    return this.post<{ enabled: boolean }>('/auth/address-book/toggle', { enabled });
  }

  toggleNewAddressLock(enabled: boolean) {
    return this.post<{ enabled: boolean }>('/auth/new-address-lock/toggle', { enabled });
  }

  getSmsAuthStatus() {
    return this.get<{ enabled: boolean }>('/auth/sms-auth/status');
  }

  toggleSmsAuth(enabled: boolean) {
    return this.post<{ enabled: boolean }>('/auth/sms-auth/toggle', { enabled });
  }

  getApiKeys() {
    return this.get<import('@exchange/mobile-types').ApiKey[]>('/auth/api-keys');
  }

  createApiKey(body: { label: string; permissions?: string[]; ip_whitelist?: string[] }) {
    return this.post<import('@exchange/mobile-types').ApiKeyCreateResult>('/auth/api-keys', body);
  }

  updateApiKey(id: string, body: { label?: string; permissions?: string[]; ip_whitelist?: string[] }) {
    return this.http.request<import('@exchange/mobile-types').ApiKey>(`/auth/api-keys/${id}`, {
      method: 'PATCH',
      body,
    });
  }

  deleteApiKey(id: string) {
    return this.http.request<{ message: string }>(`/auth/api-keys/${id}`, { method: 'DELETE' });
  }

  getFeeRates() {
    return this.get<Record<string, unknown>>('/auth/fee-rates');
  }

  getDeletionStatus() {
    return this.get<{ requested?: boolean; pending?: boolean; requestedAt?: string | null; scheduledAt?: string | null }>(
      '/auth/account/deletion-status',
    ).then((s) => ({
      pending: !!(s.requested ?? s.pending),
      requested_at: s.requestedAt ?? undefined,
      scheduled_at: s.scheduledAt ?? undefined,
    }));
  }

  requestAccountDeletion(reason?: string) {
    return this.post<{ message: string }>('/auth/account/deletion-request', { reason });
  }

  cancelAccountDeletion() {
    return this.post<{ message: string }>('/auth/account/deletion-request/cancel', {});
  }

  private get<T>(path: string, config?: { skipAuth?: boolean }) {
    return this.http.request<T>(path, { method: 'GET', skipAuth: config?.skipAuth });
  }

  private post<T>(path: string, body: unknown, config?: { skipAuth?: boolean }) {
    return this.http.request<T>(path, { method: 'POST', body, skipAuth: config?.skipAuth });
  }
}

type WalletChallengeEnvelope = {
  success?: boolean;
  challenge?: {
    id?: string;
    namespace?: string;
    chainReference?: string;
    address?: string;
    message?: string;
    nonce?: string;
    expiresAt?: string;
  };
};

export type WalletChallengeResult = {
  id: string;
  namespace: string;
  chainReference: string;
  address: string;
  message: string;
  nonce: string;
  expiresAt: string;
};

let authRepository: AuthRepository | null = null;

export function getAuthRepository(): AuthRepository {
  if (!authRepository) {
    authRepository = new AuthRepository(getHttpClient());
  }
  return authRepository;
}
