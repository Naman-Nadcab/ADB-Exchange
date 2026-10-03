/**
 * STEP 3 wallet authentication challenge.
 * Issues a one-time SIWE (EIP-4361) or SIWS message and nonce.
 * Does not verify signatures, create users, link wallets, or create sessions.
 */

import { randomBytes } from 'node:crypto';
import { CaipParseError, parseCaip10, type WalletNamespace } from '../lib/caip10.js';

export const CHALLENGE_TTL_MS = 10 * 60 * 1000;
export const AUTH_ONLY_STATEMENT =
  'THIS SIGNATURE IS FOR AUTHENTICATION ONLY. It does not authorize a transaction, payment, token transfer, withdrawal, approval, or spending.';

const NONCE_ATTEMPTS = 5;
const NONCE_PATTERN = /^[A-Za-z0-9]{8,128}$/;

export class WalletChallengeConfigError extends Error {
  constructor() {
    super('AUTH_ORIGIN_INVALID');
    this.name = 'WalletChallengeConfigError';
  }
}

export class WalletChallengePersistError extends Error {
  constructor() {
    super('CHALLENGE_PERSIST_FAILED');
    this.name = 'WalletChallengePersistError';
  }
}

export type ChallengeQuery = (
  sql: string,
  params: unknown[]
) => Promise<{ rows: WalletAuthChallengeRow[] }>;

export type WalletAuthChallengeRow = {
  id: string;
  nonce: string;
  namespace: string;
  chain_reference: string;
  normalized_address: string;
  domain: string;
  message: string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  user_id: string | null;
  created_at?: Date | string;
};

export type WalletChallenge = {
  id: string;
  namespace: WalletNamespace;
  chainReference: string;
  address: string;
  normalizedAddress: string;
  message: string;
  nonce: string;
  expiresAt: string;
};

const INSERT_CHALLENGE_SQL = `
INSERT INTO wallet_auth_challenges (
  nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id
) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NULL)
RETURNING id, nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id, created_at
`;

export function generateWalletAuthNonce(): string {
  return randomBytes(16).toString('hex');
}

export function formatRfc3339Seconds(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function truncateToSeconds(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 1000) * 1000);
}

/**
 * Domain is the URL authority (host[:port]). URI is the origin.
 * Both come from the trusted frontend URL, never from the client.
 */
export function authOriginFromFrontendUrl(frontendUrl: string): { domain: string; uri: string } {
  let url: URL;
  try {
    url = new URL(frontendUrl);
  } catch {
    throw new WalletChallengeConfigError();
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new WalletChallengeConfigError();
  }
  if (!url.host) throw new WalletChallengeConfigError();
  return { domain: url.host, uri: url.origin };
}

export function buildAuthMessage(fields: {
  namespace: WalletNamespace;
  domain: string;
  address: string;
  uri: string;
  chainReference: string;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  const accountLabel = fields.namespace === 'eip155' ? 'Ethereum' : 'Solana';
  const chainId = fields.namespace === 'eip155'
    ? fields.chainReference
    : `solana:${fields.chainReference}`;
  return [
    `${fields.domain} wants you to sign in with your ${accountLabel} account:`,
    fields.address,
    '',
    AUTH_ONLY_STATEMENT,
    '',
    `URI: ${fields.uri}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${fields.issuedAt}`,
    `Expiration Time: ${fields.expirationTime}`,
  ].join('\n');
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function isNonceCollision(err: unknown): boolean {
  if (typeof err !== 'object' || err === null || !('code' in err)) return false;
  return (err as { code?: string }).code === '23505';
}

export type CreateWalletChallengeInput = {
  caip10: string;
  frontendUrl: string;
  query: ChallengeQuery;
  now?: Date;
  generateNonce?: () => string;
  maxNonceAttempts?: number;
};

/**
 * Persist a fresh challenge. On nonce unique collision, generate a new nonce
 * and a new message. Never update an existing row and never return the
 * colliding message.
 */
export async function createWalletAuthChallenge(
  input: CreateWalletChallengeInput
): Promise<WalletChallenge> {
  const parsed = parseCaip10(input.caip10);
  const origin = authOriginFromFrontendUrl(input.frontendUrl);
  const issued = truncateToSeconds(input.now ?? new Date());
  const expires = new Date(issued.getTime() + CHALLENGE_TTL_MS);
  const issuedAt = formatRfc3339Seconds(issued);
  const expirationTime = formatRfc3339Seconds(expires);
  const generateNonce = input.generateNonce ?? generateWalletAuthNonce;
  const maxAttempts = input.maxNonceAttempts ?? NONCE_ATTEMPTS;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const nonce = generateNonce();
    if (!NONCE_PATTERN.test(nonce)) throw new WalletChallengePersistError();
    const message = buildAuthMessage({
      namespace: parsed.namespace,
      domain: origin.domain,
      address: parsed.address,
      uri: origin.uri,
      chainReference: parsed.chainReference,
      nonce,
      issuedAt,
      expirationTime,
    });
    try {
      const result = await input.query(INSERT_CHALLENGE_SQL, [
        nonce,
        parsed.namespace,
        parsed.chainReference,
        parsed.normalizedAddress,
        origin.domain,
        message,
        expires,
      ]);
      const row = result.rows[0];
      if (!row || row.message !== message || row.nonce !== nonce) {
        throw new WalletChallengePersistError();
      }
      if (row.user_id != null || row.consumed_at != null) throw new WalletChallengePersistError();
      if (row.normalized_address !== parsed.normalizedAddress) throw new WalletChallengePersistError();
      if (row.domain !== origin.domain) throw new WalletChallengePersistError();
      return {
        id: row.id,
        namespace: parsed.namespace,
        chainReference: parsed.chainReference,
        address: parsed.address,
        normalizedAddress: parsed.normalizedAddress,
        message: row.message,
        nonce: row.nonce,
        expiresAt: formatRfc3339Seconds(asDate(row.expires_at)),
      };
    } catch (err) {
      if (err instanceof WalletChallengePersistError) throw err;
      if (err instanceof CaipParseError) throw err;
      if (isNonceCollision(err)) continue;
      throw err;
    }
  }
  throw new WalletChallengePersistError();
}
