import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import type {
  P2PAd,
  P2POrder,
  P2PPlatformPaymentMethod,
  P2PUserPaymentMethod,
  P2PMessage,
  P2PReferencePrice,
  CreateP2POrderRequest,
  CreateP2PAdRequest,
  UpdateP2PAdRequest,
  P2PDispute,
  P2PMerchantStats,
} from '@exchange/mobile-types';

const PREFIX = '/p2p';

export class P2PRepository extends BaseRepository {
  getReferencePrice(asset: string, fiat: string) {
    const q = new URLSearchParams({ asset, fiat });
    return this.http.request<P2PReferencePrice | null>(`${PREFIX}/reference-price?${q}`, {
      method: 'GET',
      skipAuth: true,
    }).catch(() => null);
  }

  getAds(params?: {
    type?: string;
    currency?: string;
    fiat?: string;
    advertiser_id?: string;
    limit?: number;
    offset?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.type) q.set('type', params.type);
    if (params?.currency) q.set('currency', params.currency);
    if (params?.fiat) q.set('fiat', params.fiat);
    if (params?.advertiser_id) q.set('advertiser_id', params.advertiser_id);
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.offset != null) q.set('offset', String(params.offset));
    const suffix = q.toString() ? `?${q}` : '';
    return this.http.request<P2PAd[]>(`${PREFIX}/ads${suffix}`, { method: 'GET', skipAuth: true });
  }

  getMyAds() {
    return this.http.request<P2PAd[]>(`${PREFIX}/my-ads`, { method: 'GET' });
  }

  createAd(body: CreateP2PAdRequest) {
    return this.http.request<P2PAd>(`${PREFIX}/ads`, { method: 'POST', body, idempotent: true });
  }

  updateAd(adId: string, body: UpdateP2PAdRequest) {
    return this.http.request<P2PAd>(`${PREFIX}/my-ads/${encodeURIComponent(adId)}`, {
      method: 'PATCH',
      body,
      idempotent: true,
    });
  }

  deleteAd(adId: string) {
    return this.http.request<Record<string, unknown>>(`${PREFIX}/my-ads/${encodeURIComponent(adId)}`, {
      method: 'DELETE',
      idempotent: true,
    });
  }

  getMyOrders(status?: string) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    return this.http.request<P2POrder[]>(`${PREFIX}/my-orders${suffix}`, { method: 'GET' });
  }

  getOrder(orderId: string) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  }

  createOrder(body: CreateP2POrderRequest) {
    return this.http.request<P2POrder>(`${PREFIX}/orders`, {
      method: 'POST',
      body,
      idempotent: true,
    });
  }

  confirmPayment(orderId: string, body?: { proof_url?: string; transaction_reference?: string }) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/confirm-payment`, {
      method: 'POST',
      body: body ?? {},
      idempotent: true,
    });
  }

  verifyPayment(orderId: string) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/verify-payment`, {
      method: 'POST',
      body: {},
    });
  }

  releaseOrder(orderId: string, idempotencyKey?: string) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/release`, {
      method: 'POST',
      body: {},
      idempotent: true,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  cancelOrder(orderId: string, reason: string, idempotencyKey?: string) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/cancel`, {
      method: 'POST',
      body: { reason },
      idempotent: true,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  openDispute(orderId: string, reason: string, evidence?: string[]) {
    return this.http.request<{ id: string }>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/dispute`, {
      method: 'POST',
      body: { reason, evidence },
    });
  }

  getDispute(disputeId: string) {
    return this.http.request<P2PDispute>(`${PREFIX}/disputes/${encodeURIComponent(disputeId)}`, { method: 'GET' });
  }

  uploadPaymentProof(orderId: string, form: FormData) {
    return this.http.request<{ proof_url: string }>(
      `${PREFIX}/orders/${encodeURIComponent(orderId)}/upload-payment-proof`,
      { method: 'POST', formBody: form },
    );
  }

  submitPayment(orderId: string, form: FormData, idempotencyKey?: string) {
    return this.http.request<P2POrder>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/pay`, {
      method: 'POST',
      formBody: form,
      idempotent: true,
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  }

  getMessages(orderId: string, since?: string) {
    let path = `${PREFIX}/orders/${encodeURIComponent(orderId)}/messages`;
    if (since?.trim()) path += `?since=${encodeURIComponent(since.trim())}`;
    return this.http.request<P2PMessage[]>(path, { method: 'GET' });
  }

  sendMessage(orderId: string, message: string) {
    return this.http.request<P2PMessage>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/messages`, {
      method: 'POST',
      body: { message },
    });
  }

  markMessagesRead(orderId: string, lastReadMessageId?: string) {
    return this.http.request<unknown>(`${PREFIX}/orders/${encodeURIComponent(orderId)}/messages/read`, {
      method: 'POST',
      body: { last_read_message_id: lastReadMessageId },
    });
  }

  getPlatformPaymentMethods() {
    return this.http.request<P2PPlatformPaymentMethod[]>(`${PREFIX}/payment-methods`, {
      method: 'GET',
      skipAuth: true,
    });
  }

  getMyPaymentMethods(includeInactive = false) {
    const suffix = includeInactive ? '?include_inactive=1' : '';
    return this.http.request<P2PUserPaymentMethod[]>(`${PREFIX}/my-payment-methods${suffix}`, { method: 'GET' });
  }

  addPaymentMethod(body: {
    payment_method_id: string;
    payment_details?: Record<string, unknown>;
    display_name?: string;
  }) {
    return this.http.request<P2PUserPaymentMethod>(`${PREFIX}/my-payment-methods`, { method: 'POST', body });
  }

  updatePaymentMethod(
    id: string,
    body: { is_active?: boolean; is_default?: boolean; priority?: number; payment_details?: Record<string, unknown>; display_name?: string },
  ) {
    return this.http.request<P2PUserPaymentMethod>(`${PREFIX}/my-payment-methods/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body,
    });
  }

  deletePaymentMethod(id: string) {
    return this.http.request<{ deleted: boolean; id: string }>(
      `${PREFIX}/my-payment-methods/${encodeURIComponent(id)}`,
      { method: 'DELETE' },
    );
  }

  getMerchantStats() {
    return this.http.request<P2PMerchantStats | null>(`${PREFIX}/merchant-stats`, { method: 'GET' });
  }

  blockAdvertiser(advertiserId: string) {
    return this.http.request<unknown>(`${PREFIX}/blocked-advertisers`, {
      method: 'POST',
      body: { advertiser_id: advertiserId },
    });
  }

  unblockAdvertiser(advertiserId: string) {
    return this.http.request<unknown>(`${PREFIX}/blocked-advertisers/${encodeURIComponent(advertiserId)}`, {
      method: 'DELETE',
    });
  }
}

let p2pRepository: P2PRepository | null = null;

export function getP2PRepository(): P2PRepository {
  if (!p2pRepository) p2pRepository = new P2PRepository(getHttpClient());
  return p2pRepository;
}
