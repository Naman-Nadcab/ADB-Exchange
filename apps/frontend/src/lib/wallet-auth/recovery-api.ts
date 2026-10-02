import { getApiBaseUrl } from '@/lib/getApiUrl';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';

export type RecoveryFactors = {
  activeWalletCount: number;
  passkeyCount: number;
  totpEnabled: boolean;
  hasPassword: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
};

export type RecoveryView = {
  id: string;
  status: string;
  factor: string | null;
  replacementMode: string;
  lostWalletId: string | null;
  proposedCaip10: string | null;
  replacementWalletId: string | null;
  cooldownUntil: string | null;
  withdrawalFrozen: boolean;
  kycStatus: string | null;
  factors: RecoveryFactors;
  createdAt: string;
  updatedAt: string;
};

export class WalletRecoveryApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'WalletRecoveryApiError';
    this.status = status;
    this.code = code;
  }
}

function bearer(accessToken: string | null | undefined): string | undefined {
  if (!accessToken || accessToken === COOKIE_SESSION_MARKER) return undefined;
  if (!accessToken.includes('.')) return undefined;
  return accessToken;
}

async function requestJson(
  method: 'GET' | 'POST',
  path: string,
  accessToken: string | null | undefined,
  body?: Record<string, unknown>
): Promise<{ status: number; json: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(bearer(accessToken) ? { Authorization: `Bearer ${bearer(accessToken)}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new WalletRecoveryApiError(0, 'NETWORK');
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

function errorCode(json: Record<string, unknown>): string {
  const error = json.error as { code?: string } | undefined;
  return error?.code || 'FAILED';
}

export async function getWalletRecovery(accessToken: string | null): Promise<RecoveryView | null> {
  const { status, json } = await requestJson('GET', '/api/v1/auth/wallets/recovery', accessToken);
  if (status === 401) throw new WalletRecoveryApiError(status, 'UNAUTHORIZED');
  if (status !== 200) throw new WalletRecoveryApiError(status, errorCode(json));
  const data = json.data as { recovery?: RecoveryView | null } | undefined;
  return data?.recovery ?? null;
}

export async function requestWalletRecovery(accessToken: string | null, lostWalletId?: string): Promise<RecoveryView> {
  const { status, json } = await requestJson('POST', '/api/v1/auth/wallets/recovery', accessToken, lostWalletId ? { lostWalletId } : {});
  if (status !== 200) throw new WalletRecoveryApiError(status, errorCode(json));
  const data = json.data as { recovery?: RecoveryView } | undefined;
  if (!data?.recovery) throw new WalletRecoveryApiError(status, 'FAILED');
  return data.recovery;
}

export async function cancelWalletRecovery(accessToken: string | null): Promise<void> {
  const { status, json } = await requestJson('POST', '/api/v1/auth/wallets/recovery/cancel', accessToken, {});
  if (status !== 200) throw new WalletRecoveryApiError(status, errorCode(json));
}
