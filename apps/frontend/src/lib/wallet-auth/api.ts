import { getApiBaseUrl } from '@/lib/getApiUrl';

/**
 * Wallet auth HTTP client.
 * Session creation is POST /api/v1/auth/wallet/login.
 * That route verifies the signature and opens the existing application session.
 * POST /api/v1/auth/wallet/verify does not create a user or a session.
 */

export type WalletChallengeResponse = {
  id: string;
  message: string;
  namespace: string;
  chainReference: string;
  address: string;
  expiresAt: string;
};

export type WalletLoginSuccess = {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
};

export class WalletApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string) {
    super(code);
    this.name = 'WalletApiError';
    this.status = status;
    this.code = code;
  }
}

async function postJson(path: string, body: Record<string, unknown>): Promise<{ status: number; json: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new WalletApiError(0, 'NETWORK');
  }
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, json };
}

export async function walletChallenge(caip10: string): Promise<WalletChallengeResponse> {
  const { status, json } = await postJson('/api/v1/auth/wallet/challenge', { caip10 });
  const challenge = json.challenge as Partial<WalletChallengeResponse> | undefined;
  if (!status || status >= 400 || json.success !== true || !challenge?.id || !challenge.message) {
    const error = json.error as { code?: string } | undefined;
    throw new WalletApiError(status, error?.code || 'CHALLENGE_FAILED');
  }
  return {
    id: challenge.id,
    message: challenge.message,
    namespace: challenge.namespace ?? '',
    chainReference: challenge.chainReference ?? '',
    address: challenge.address ?? '',
    expiresAt: challenge.expiresAt ?? '',
  };
}

/** Verifies the signature and creates the existing session. Does not call /wallet/verify. */
export async function walletVerify(input: {
  challengeId: string;
  message: string;
  signature: string;
}): Promise<WalletLoginSuccess> {
  const { status, json } = await postJson('/api/v1/auth/wallet/login', {
    challengeId: input.challengeId,
    message: input.message,
    signature: input.signature,
  });
  const data = json.data as { user?: Record<string, unknown>; accessToken?: string; refreshToken?: string } | undefined;
  if (!status || status >= 400 || json.success !== true || !data?.user || typeof data.user.id !== 'string') {
    const error = json.error as { code?: string } | undefined;
    throw new WalletApiError(status, error?.code || 'VERIFY_FAILED');
  }
  return {
    user: data.user,
    accessToken: typeof data.accessToken === 'string' ? data.accessToken : '',
    refreshToken: typeof data.refreshToken === 'string' ? data.refreshToken : '',
  };
}
