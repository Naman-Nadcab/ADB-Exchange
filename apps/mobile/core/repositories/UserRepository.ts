import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import type {
  UserProfile,
  UserSession,
  LoginActivity,
  UserNotification,
  ReferralStats,
  ReferralEntry,
  FeeTier,
  SupportTicket,
  SupportTicketDetail,
} from '@exchange/mobile-types';

export class UserRepository extends BaseRepository {
  getProfile() {
    return this.http.request<UserProfile>('/user/profile', { method: 'GET' });
  }

  updateProfile(body: Partial<Pick<UserProfile, 'first_name' | 'last_name' | 'username'>>) {
    return this.http.request<UserProfile>('/user/profile', { method: 'PATCH', body });
  }

  uploadAvatar(form: FormData) {
    return this.http.request<{ avatar_url: string }>('/user/avatar', { method: 'POST', formBody: form });
  }

  deleteAvatar() {
    return this.http.request<unknown>('/user/avatar', { method: 'DELETE' });
  }

  getSessions() {
    return this.http.request<UserSession[]>('/user/sessions', { method: 'GET' });
  }

  getActivity() {
    return this.http.request<LoginActivity[]>('/user/activity', { method: 'GET' });
  }

  getNotifications() {
    return this.http.request<UserNotification[]>('/user/notifications', { method: 'GET' });
  }

  markNotificationRead(id: string) {
    return this.http.request<unknown>(`/user/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  }

  markAllNotificationsRead() {
    return this.http.request<unknown>('/user/notifications/read-all', { method: 'POST', body: {} });
  }

  getFeeTier() {
    return this.http.request<FeeTier>('/user/fee-tier', { method: 'GET' });
  }

  getReferrals() {
    return this.http.request<ReferralEntry[]>('/user/referrals', { method: 'GET' });
  }

  getReferralAnalytics() {
    return this.http.request<ReferralStats>('/user/referrals/analytics', { method: 'GET' });
  }

  claimReferralRewards() {
    return this.http.request<unknown>('/user/referrals/claim', { method: 'POST', body: {} });
  }

  getRiskStatus() {
    return this.http.request<{ restricted?: boolean; message?: string }>('/user/risk-status', { method: 'GET' });
  }

  getUserKyc() {
    return this.http.request<Record<string, unknown>>('/user/kyc', { method: 'GET' });
  }

  getAnnouncements() {
    return this.http.request<{ id: string; title: string; created_at: string }[]>('/user/announcements', {
      method: 'GET',
    });
  }

  getAnnouncement(id: string) {
    return this.http.request<Record<string, unknown>>(`/user/announcements/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
  }
}

export class KycRepository extends BaseRepository {
  getStatus() {
    return this.http.request<import('@exchange/mobile-types').KycStatus>('/kyc/status', { method: 'GET' });
  }

  initiate(body: import('@exchange/mobile-types').InitiateKycRequest) {
    return this.http.request<{ applicationId?: string }>('/kyc/initiate', { method: 'POST', body });
  }

  uploadDocument(form: FormData) {
    return this.http.request<{ url?: string }>('/kyc/upload-document', { method: 'POST', formBody: form });
  }
}

export class SupportRepository extends BaseRepository {
  getTickets() {
    return this.http.request<SupportTicket[]>('/support/tickets', { method: 'GET' });
  }

  createTicket(body: { subject: string; message: string; category?: string }) {
    return this.http.request<SupportTicket>('/support/tickets', { method: 'POST', body });
  }

  getTicket(id: string) {
    return this.http.request<SupportTicketDetail>(`/support/tickets/${encodeURIComponent(id)}`, { method: 'GET' });
  }

  replyToTicket(id: string, message: string) {
    return this.http.request<unknown>(`/support/tickets/${encodeURIComponent(id)}/reply`, {
      method: 'POST',
      body: { message },
    });
  }
}

export class PushRepository extends BaseRepository {
  subscribe(body: { endpoint: string; keys?: Record<string, string>; platform?: string; token?: string }) {
    return this.http.request<unknown>('/push/subscribe', { method: 'POST', body });
  }

  unsubscribe(body: { endpoint?: string }) {
    return this.http.request<unknown>('/push/unsubscribe', { method: 'POST', body });
  }
}

let userRepository: UserRepository | null = null;
let kycRepository: KycRepository | null = null;
let supportRepository: SupportRepository | null = null;
let pushRepository: PushRepository | null = null;

export function getUserRepository(): UserRepository {
  if (!userRepository) userRepository = new UserRepository(getHttpClient());
  return userRepository;
}

export function getKycRepository(): KycRepository {
  if (!kycRepository) kycRepository = new KycRepository(getHttpClient());
  return kycRepository;
}

export function getSupportRepository(): SupportRepository {
  if (!supportRepository) supportRepository = new SupportRepository(getHttpClient());
  return supportRepository;
}

export function getPushRepository(): PushRepository {
  if (!pushRepository) pushRepository = new PushRepository(getHttpClient());
  return pushRepository;
}
