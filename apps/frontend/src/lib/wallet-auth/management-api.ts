import { getApiBaseUrl } from '@/lib/getApiUrl';
import { COOKIE_SESSION_MARKER } from '@/lib/authSession';

/**
 * Authenticated wallet-management client.
 * The server uses the session identity. This client never sends a user id.
 */

export type ManagedWallet = {
  id: string;
  namespace: string;
  chainReference: string;
  address: string;
  provider: string | null;
  walletType: string;
  isPrimary: boolean;
  isVerified: boolean;
  verifiedAt: string | null;
  linkedAt: string | null;
  lastUsedAt: string | null;
  status: string;
};

export type WalletManagementChallenge = {
  id: string;
  message: string;
  namespace: string;
  chainReference: string;
  address: string;
  expiresAt: string;
  signing: 'personal' | 'typed_data';
  action?: string;
};

export class WalletManagementApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'WalletManagementApiError';
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
    throw new WalletManagementApiError(0, 'NETWORK');
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

function errorCode(json: Record<string, unknown>, fallback: string): string {
  const error = json.error as { code?: string } | undefined;
  return error?.code || fallback;
}

function readChallenge(json: Record<string, unknown>): WalletManagementChallenge {
  const challenge = json.challenge as Partial<WalletManagementChallenge> | undefined;
  if (json.success !== true || !challenge?.id || !challenge.message) {
    throw new WalletManagementApiError(0, 'CHALLENGE_FAILED');
  }
  return {
    id: challenge.id,
    message: challenge.message,
    namespace: challenge.namespace ?? '',
    chainReference: challenge.chainReference ?? '',
    address: challenge.address ?? '',
    expiresAt: challenge.expiresAt ?? '',
    signing: challenge.signing === 'typed_data' ? 'typed_data' : 'personal',
    action: challenge.action,
  };
}

export async function listManagedWallets(accessToken: string | null | undefined): Promise<ManagedWallet[]> {
  const { status, json } = await requestJson('GET', '/api/v1/auth/wallets', accessToken);
  const data = json.data as { wallets?: ManagedWallet[] } | undefined;
  if (!status || status >= 400 || json.success !== true || !Array.isArray(data?.wallets)) {
    throw new WalletManagementApiError(status, errorCode(json, 'LIST_FAILED'));
  }
  return data.wallets;
}

export async function requestLinkChallenge(
  accessToken: string | null | undefined,
  caip10: string,
  provider?: string
): Promise<WalletManagementChallenge> {
  const body: Record<string, unknown> = { caip10 };
  if (provider) body.provider = provider;
  const { status, json } = await requestJson('POST', '/api/v1/auth/wallets/link/challenge', accessToken, body);
  if (!status || status >= 400) throw new WalletManagementApiError(status, errorCode(json, 'CHALLENGE_FAILED'));
  return readChallenge(json);
}

export async function verifyLinkChallenge(
  accessToken: string | null | undefined,
  proof: { challengeId: string; message: string; signature: string }
): Promise<ManagedWallet> {
  const { status, json } = await requestJson('POST', '/api/v1/auth/wallets/link/verify', accessToken, proof);
  const data = json.data as { wallet?: ManagedWallet } | undefined;
  if (!status || status >= 400 || json.success !== true || !data?.wallet?.id) {
    throw new WalletManagementApiError(status, errorCode(json, 'VERIFY_FAILED'));
  }
  return data.wallet;
}

export async function requestStepUp(
  accessToken: string | null | undefined,
  walletId: string,
  action: 'set_primary_wallet' | 'unlink_wallet'
): Promise<WalletManagementChallenge> {
  const { status, json } = await requestJson(
    'POST',
    `/api/v1/auth/wallets/${walletId}/step-up`,
    accessToken,
    { action }
  );
  if (!status || status >= 400) throw new WalletManagementApiError(status, errorCode(json, 'CHALLENGE_FAILED'));
  return readChallenge(json);
}

export async function submitWalletAction(
  accessToken: string | null | undefined,
  walletId: string,
  action: 'primary' | 'unlink',
  proof: { challengeId: string; message: string; signature: string }
): Promise<ManagedWallet> {
  const { status, json } = await requestJson(
    'POST',
    `/api/v1/auth/wallets/${walletId}/${action}`,
    accessToken,
    proof
  );
  const data = json.data as { wallet?: ManagedWallet } | undefined;
  if (!status || status >= 400 || json.success !== true || !data?.wallet?.id) {
    throw new WalletManagementApiError(status, errorCode(json, 'ACTION_FAILED'));
  }
  return data.wallet;
}
