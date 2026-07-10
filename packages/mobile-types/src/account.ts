export type UserProfile = {
  id: string;
  email: string;
  phone?: string | null;
  phone_verified?: boolean;
  first_name?: string | null;
  last_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  totp_enabled?: boolean;
  sms_auth_enabled?: boolean;
  passkeys_enabled?: boolean;
  has_fund_password?: boolean;
  anti_phishing_code?: string | null;
  withdrawal_whitelist_enabled?: boolean;
  address_book_enabled?: boolean;
  tier_level?: number;
  kyc_status?: string;
  kyc_level?: number;
  referral_code?: string | null;
  devices_count?: number;
  last_login_at?: string | null;
  created_at?: string;
};

export type SecuritySettings = {
  twoFaEnabled?: boolean;
  smsAuthEnabled?: boolean;
  passkeysCount?: number;
  fundPasswordSet?: boolean;
  antiPhishingSet?: boolean;
  whitelistEnabled?: boolean;
  addressBookEnabled?: boolean;
  newAddressLockEnabled?: boolean;
  score?: number;
  checklist?: Array<{ id: string; label: string; done: boolean }>;
};

export type UserSession = {
  id: string;
  device?: string;
  ip?: string;
  location?: string;
  last_active_at?: string;
  created_at?: string;
  current?: boolean;
};

export type LoginActivity = {
  id: string;
  action: string;
  ip?: string;
  device?: string;
  created_at: string;
};

export type UserNotification = {
  id: string;
  type: string;
  title: string;
  body?: string;
  read: boolean;
  created_at: string;
  data?: Record<string, unknown>;
};

export type NotificationPreferences = {
  price_alerts?: boolean;
  p2p_alerts?: boolean;
  trading_alerts?: boolean;
  security_alerts?: boolean;
  marketing?: boolean;
};

export type UserPreferences = {
  theme?: 'light' | 'dark' | 'system';
  language?: string;
  currency?: string;
  timezone?: string;
  number_format?: string;
  sound_enabled?: boolean;
  haptics_enabled?: boolean;
  notifications?: NotificationPreferences;
};

export type ApiKey = {
  id: string;
  label: string;
  key_prefix?: string;
  permissions?: string[];
  ip_whitelist?: string[];
  created_at?: string;
  last_used_at?: string | null;
};

export type ApiKeyCreateResult = ApiKey & {
  secret?: string;
  api_key?: string;
};

export type ReferralStats = {
  referral_code?: string;
  total_referrals?: number;
  active_referrals?: number;
  total_commission?: string;
  pending_commission?: string;
};

export type ReferralEntry = {
  id: string;
  referred_user?: string;
  status?: string;
  commission?: string;
  created_at?: string;
};

export type FeeTier = {
  tier_level?: number;
  tier_name?: string;
  maker_fee?: string;
  taker_fee?: string;
  vip?: boolean;
};

export type SupportTicket = {
  id: string;
  subject: string;
  status: string;
  category?: string;
  created_at: string;
  updated_at?: string;
};

export type SupportMessage = {
  id: string;
  message: string;
  sender_type: 'user' | 'admin' | string;
  created_at: string;
  attachments?: string[];
};

export type SupportTicketDetail = SupportTicket & {
  messages: SupportMessage[];
};

export type AccountDeletionStatus = {
  pending: boolean;
  requested_at?: string;
  scheduled_at?: string;
};
