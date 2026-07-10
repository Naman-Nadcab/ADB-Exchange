import { getApiBaseUrl } from '@core/config/env';
import { applyAuthInterceptor } from './interceptors/authInterceptor';
import { applyIdempotencyInterceptor } from './interceptors/idempotencyInterceptor';
import { applyRateLimitInterceptor } from './interceptors/rateLimitInterceptor';
import { applyErrorInterceptor } from './interceptors/errorInterceptor';
import { deserializeBody, serializeBody } from './serializer';
import type { AuthHooks } from './authHooks';
import { unwrapApiData, type ApiResponse } from './types/apiResponse';
import { getDeviceId } from '@core/auth/deviceId';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type HttpRequestConfig = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  /** Multipart form body — skips JSON Content-Type. */
  formBody?: FormData;
  timeoutMs?: number;
  signal?: AbortSignal;
  skipAuth?: boolean;
  idempotent?: boolean;
  /** Return full API envelope (keeps pagination/total alongside data). */
  retainEnvelope?: boolean;
};

export type HttpClientDeps = {
  getBaseUrl: () => string;
  authHooks?: AuthHooks;
};

const DEFAULT_TIMEOUT_MS = 30_000;

export class HttpClient {
  private deviceId: string | null = null;

  constructor(private readonly deps: HttpClientDeps) {}

  async request<T>(path: string, config: HttpRequestConfig = {}): Promise<T> {
    const url = `${this.deps.getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
    if (!this.deviceId) {
      this.deviceId = await getDeviceId();
    }

    let ctx = applyAuthInterceptor(
      {
        headers: {
          Accept: 'application/json',
          'X-Request-Id': globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`,
          'X-Device-Id': this.deviceId,
          ...(config.formBody ? {} : { 'Content-Type': 'application/json' }),
          ...config.headers,
        },
        skipAuth: config.skipAuth,
        idempotent: config.idempotent,
      },
      {
        getAccessToken: () => this.deps.authHooks?.getSession().accessToken ?? null,
      },
    );
    ctx = applyIdempotencyInterceptor(ctx);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const signal = config.signal ?? controller.signal;

    let response: Response;
    try {
      response = await fetch(url, {
        method: config.method ?? 'GET',
        headers: ctx.headers,
        body: config.formBody ?? serializeBody(config.body),
        signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      throw err;
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 && !config.skipAuth && this.deps.authHooks) {
      const newToken = await this.deps.authHooks.onRefreshRequired();
      if (newToken) {
        return this.request<T>(path, {
          ...config,
          headers: { ...ctx.headers, Authorization: `Bearer ${newToken}` },
        });
      }
      this.deps.authHooks.onSessionCleared();
    }

    applyRateLimitInterceptor({
      status: response.status,
      headers: response.headers,
      body: null,
    });

    const text = await response.text();
    const data = deserializeBody<unknown>(text);

    if (!response.ok) {
      applyErrorInterceptor({ status: response.status, body: data });
    }

    if (data && typeof data === 'object' && 'success' in (data as ApiResponse<T>)) {
      if (config.retainEnvelope) {
        const envelope = data as ApiResponse<T> & Record<string, unknown>;
        if (envelope.success === false) {
          applyErrorInterceptor({ status: response.status, body: data });
        }
        return envelope as T;
      }
      return unwrapApiData<T>(data);
    }

    return data as T;
  }
}

let httpClientSingleton: HttpClient | null = null;

export function createHttpClient(deps: HttpClientDeps): HttpClient {
  httpClientSingleton = new HttpClient(deps);
  return httpClientSingleton;
}

export function getHttpClient(): HttpClient {
  if (!httpClientSingleton) {
    httpClientSingleton = new HttpClient({
      getBaseUrl: getApiBaseUrl,
    });
  }
  return httpClientSingleton;
}

export function resetHttpClient(): void {
  httpClientSingleton = null;
}
