import { BaseRepository } from './BaseRepository';
import { getHttpClient } from '../api/httpClient';
import type {
  ConvertCurrency,
  ConvertQuote,
  ConvertInstantRequest,
  ConvertInstantResult,
  ConvertHistoryItem,
  ConvertBalance,
  ConvertDustResult,
  AccountType,
} from '@exchange/mobile-types';

type ConvertHistoryResponse = {
  data: ConvertHistoryItem[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

export class ConvertRepository extends BaseRepository {
  getCurrencies() {
    return this.http.request<ConvertCurrency[]>('/convert/currencies', { method: 'GET', skipAuth: true });
  }

  getQuote(from: string, to: string, amount = '1') {
    return this.http.request<ConvertQuote>(
      `/convert/quote?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`,
      { method: 'GET' },
    );
  }

  executeInstant(body: ConvertInstantRequest) {
    return this.http.request<ConvertInstantResult>('/convert/instant', {
      method: 'POST',
      body,
      idempotent: true,
    });
  }

  getHistory(params?: { page?: number; limit?: number; type?: string; status?: string }) {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    if (params?.type) q.set('type', params.type);
    if (params?.status) q.set('status', params.status);
    const suffix = q.toString() ? `?${q}` : '';
    return this.http
      .request<ConvertHistoryResponse>(`/convert/history${suffix}`, {
        method: 'GET',
        retainEnvelope: true,
      })
      .then((r) => ({ items: r.data, pagination: r.pagination }));
  }

  getBalances(accountType: AccountType = 'spot') {
    return this.http.request<ConvertBalance[]>(`/convert/balances?accountType=${accountType}`, {
      method: 'GET',
    });
  }

  convertDust(threshold = 1) {
    return this.http.request<ConvertDustResult>('/wallet/convert-dust', {
      method: 'POST',
      body: { threshold },
      idempotent: true,
    });
  }
}

let convertRepository: ConvertRepository | null = null;

export function getConvertRepository(): ConvertRepository {
  if (!convertRepository) {
    convertRepository = new ConvertRepository(getHttpClient());
  }
  return convertRepository;
}
