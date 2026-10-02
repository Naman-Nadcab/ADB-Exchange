/**
 * STEP 4 wallet signature verification.
 * Proves the signer controls the key for one server-issued challenge.
 * Does not create a user, link a wallet, or open a session.
 *
 * A failed signature leaves the challenge unconsumed so a later valid
 * signature can still succeed until expiry. Consumption happens only after
 * the signature checks pass, inside the same transaction, with a conditional
 * update so two concurrent requests cannot both commit.
 *
 * EIP-1271 contract-wallet verification is disabled. A signature that does
 * not recover to the challenge address is rejected. There is no RPC call.
 */

import { createHash, createPublicKey, verify as verifyEd25519 } from 'node:crypto';
import { verifyMessage } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { decodeBase58 } from '../lib/base58.js';
import { parseWalletAuthMessage } from '../lib/wallet-auth-message.js';
import {
  CHALLENGE_TTL_MS,
  authOriginFromFrontendUrl,
  formatRfc3339Seconds,
  type ChallengeQuery,
  type WalletAuthChallengeRow,
} from './wallet-auth-challenge.service.js';

/** Issued-at may differ from the server clock by at most this much. Expiry has no grace. */
export const ISSUED_AT_SKEW_MS = 60_000;

/** Contract-wallet signatures are not accepted in this step. */
export const WALLET_AUTH_EIP1271_ENABLED = false;

const EVM_SIGNATURE = /^0x[0-9a-fA-F]{130}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

export type WalletVerifyCode =
  | 'INVALID_CHALLENGE'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_UNAVAILABLE'
  | 'INVALID_SIGNATURE';

export class WalletVerifyError extends Error {
  readonly code: WalletVerifyCode;
  readonly challengeId?: string;
  readonly namespace?: string;
  readonly chainReference?: string;
  readonly normalizedAddress?: string;

  constructor(
    code: WalletVerifyCode,
    context?: {
      challengeId?: string;
      namespace?: string;
      chainReference?: string;
      normalizedAddress?: string;
    }
  ) {
    super(code);
    this.name = 'WalletVerifyError';
    this.code = code;
    this.challengeId = context?.challengeId;
    this.namespace = context?.namespace;
    this.chainReference = context?.chainReference;
    this.normalizedAddress = context?.normalizedAddress;
  }
}

export class WalletVerifyRateLimited extends Error {
  readonly unavailable: boolean;
  readonly identifier: string;

  constructor(unavailable: boolean, identifier: string) {
    super('RATE_LIMIT');
    this.name = 'WalletVerifyRateLimited';
    this.unavailable = unavailable;
    this.identifier = identifier;
  }
}

export type VerifiedWallet = {
  verified: true;
  wallet: {
    namespace: 'eip155' | 'solana';
    chainReference: string;
    address: string;
    caip10: string;
  };
  challengeId: string;
  normalizedAddress: string;
};

export type VerifyTransaction = <T>(fn: (query: ChallengeQuery) => Promise<T>) => Promise<T>;

const LOCK_CHALLENGE_SQL = `
SELECT id, nonce, namespace, chain_reference, normalized_address, domain, message,
       expires_at, consumed_at, user_id
FROM wallet_auth_challenges
WHERE id = $1::uuid
FOR UPDATE
`;

const CONSUME_CHALLENGE_SQL = `
UPDATE wallet_auth_challenges
SET consumed_at = $2,
    user_id = COALESCE($4::uuid, user_id)
WHERE id = $1::uuid
  AND consumed_at IS NULL
  AND expires_at > $3
RETURNING id
`;

/**
 * Raised inside the verification transaction when the signature is valid
 * but login must still be refused (disabled wallet, inactive account).
 * The challenge is consumed and the transaction commits; no session is created.
 */
export class WalletAuthDenied extends Error {
  readonly code: 'WALLET_UNAVAILABLE' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_LOCKED';
  readonly userId?: string;
  readonly lockedUntil?: Date;

  constructor(
    code: 'WALLET_UNAVAILABLE' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_LOCKED',
    userId?: string,
    lockedUntil?: Date
  ) {
    super(code);
    this.name = 'WalletAuthDenied';
    this.code = code;
    this.userId = userId;
    this.lockedUntil = lockedUntil;
  }
}

export type VerifiedChallengeContext = {
  query: ChallengeQuery;
  now: Date;
  row: WalletAuthChallengeRow;
  address: string;
  namespace: 'eip155' | 'solana';
  chainReference: string;
  normalizedAddress: string;
  caip10: string;
  assignUserId: (userId: string) => void;
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

export function messageSha256(message: string): string {
  return createHash('sha256').update(message, 'utf8').digest('hex');
}

/** EIP-191 personal_sign recovery. Returns false for a bad or mismatched signature. */
export function verifyEvmEoaSignature(
  message: string,
  signature: string,
  normalizedAddress: string
): boolean {
  if (!EVM_SIGNATURE.test(signature)) return false;
  try {
    const recovered = verifyMessage(message, signature);
    return recovered.toLowerCase() === normalizedAddress;
  } catch {
    return false;
  }
}

/** Ed25519 over the exact UTF-8 message bytes. Solana addresses are not lowercased. */
export function verifySolanaSignature(
  message: string,
  signature: string,
  address: string
): boolean {
  if (!signature || signature.length > 128 || signature.startsWith('0x')) return false;
  try {
    const signatureBytes = decodeBase58(signature);
    if (signatureBytes.length !== 64) return false;
    const key = new PublicKey(address);
    if (key.toBase58() !== address) return false;
    const publicKey = key.toBytes();
    if (publicKey.length !== 32) return false;
    const spki = Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey)]);
    const keyObject = createPublicKey({ key: spki, format: 'der', type: 'spki' });
    return verifyEd25519(
      null,
      Buffer.from(message, 'utf8'),
      keyObject,
      Buffer.from(signatureBytes)
    );
  } catch {
    return false;
  }
}

function contextFrom(row: WalletAuthChallengeRow): {
  challengeId: string;
  namespace: string;
  chainReference: string;
  normalizedAddress: string;
} {
  return {
    challengeId: row.id,
    namespace: row.namespace,
    chainReference: row.chain_reference,
    normalizedAddress: row.normalized_address,
  };
}

function assertMessageBindings(
  row: WalletAuthChallengeRow,
  message: string,
  frontendUrl: string,
  now: Date
): { address: string; namespace: 'eip155' | 'solana'; chainReference: string } {
  const ctx = contextFrom(row);
  if (message !== row.message) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  const parsed = parseWalletAuthMessage(message);
  if (!parsed) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (parsed.namespace !== row.namespace) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);

  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(frontendUrl);
  } catch {
    throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  }
  if (parsed.domain !== row.domain || parsed.domain !== origin.domain) {
    throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  }
  if (parsed.uri !== origin.uri) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (parsed.chainReference !== row.chain_reference) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (parsed.nonce !== row.nonce) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (parsed.expirationTime !== formatRfc3339Seconds(asDate(row.expires_at))) {
    throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  }

  const issuedMs = Date.parse(parsed.issuedAt);
  if (!Number.isFinite(issuedMs)) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (issuedMs > now.getTime() + ISSUED_AT_SKEW_MS) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  if (issuedMs < now.getTime() - CHALLENGE_TTL_MS - ISSUED_AT_SKEW_MS) {
    throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  }
  const expiryMs = Date.parse(parsed.expirationTime);
  if (!Number.isFinite(expiryMs) || expiryMs <= issuedMs) throw new WalletVerifyError('INVALID_CHALLENGE', ctx);

  if (parsed.namespace === 'eip155') {
    if (parsed.address.toLowerCase() !== row.normalized_address) {
      throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
    }
  } else if (parsed.address !== row.normalized_address) {
    throw new WalletVerifyError('INVALID_CHALLENGE', ctx);
  }

  return {
    address: parsed.address,
    namespace: parsed.namespace,
    chainReference: parsed.chainReference,
  };
}

export async function verifyWalletAuthChallenge(input: {
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  now?: Date;
  transaction: VerifyTransaction;
  beforeSignature?: (row: {
    normalizedAddress: string;
    namespace: string;
    chainReference: string;
  }) => Promise<void>;
  /**
   * Runs after the signature matches and before the challenge is consumed.
   * Used by wallet login to resolve users.id in the same transaction.
   * WalletAuthDenied still consumes the challenge, then commits.
   */
  afterVerified?: (ctx: VerifiedChallengeContext) => Promise<void>;
}): Promise<VerifiedWallet> {
  if (!UUID_PATTERN.test(input.challengeId)) {
    throw new WalletVerifyError('INVALID_CHALLENGE', { challengeId: input.challengeId });
  }
  const now = input.now ?? new Date();
  let linkedUserId: string | null = null;

  const outcome = await input.transaction(async (query) => {
    const found = await query(LOCK_CHALLENGE_SQL, [input.challengeId]);
    const row = found.rows[0];
    if (!row) throw new WalletVerifyError('INVALID_CHALLENGE', { challengeId: input.challengeId });
    const ctx = contextFrom(row);
    if (row.consumed_at != null) throw new WalletVerifyError('CHALLENGE_UNAVAILABLE', ctx);
    if (asDate(row.expires_at).getTime() <= now.getTime()) {
      throw new WalletVerifyError('CHALLENGE_EXPIRED', ctx);
    }

    if (input.beforeSignature) {
      await input.beforeSignature({
        normalizedAddress: row.normalized_address,
        namespace: row.namespace,
        chainReference: row.chain_reference,
      });
    }

    const bound = assertMessageBindings(row, input.message, input.frontendUrl, now);
    const signatureOk = bound.namespace === 'eip155'
      ? verifyEvmEoaSignature(input.message, input.signature, row.normalized_address)
      : verifySolanaSignature(input.message, input.signature, bound.address);
    if (!signatureOk) {
      // EIP-1271 is not consulted. Contract signatures fail closed with the EOA result.
      throw new WalletVerifyError('INVALID_SIGNATURE', ctx);
    }

    const caip10 = `${bound.namespace}:${bound.chainReference}:${bound.address}`;
    let denial: WalletAuthDenied | null = null;
    if (input.afterVerified) {
      try {
        await input.afterVerified({
          query,
          now,
          row,
          address: bound.address,
          namespace: bound.namespace,
          chainReference: bound.chainReference,
          normalizedAddress: row.normalized_address,
          caip10,
          assignUserId: (userId: string) => {
            linkedUserId = userId;
          },
        });
      } catch (err) {
        if (err instanceof WalletAuthDenied) denial = err;
        else throw err;
      }
    }

    const consumed = await query(CONSUME_CHALLENGE_SQL, [row.id, now, now, linkedUserId]);
    if (consumed.rows.length !== 1) throw new WalletVerifyError('CHALLENGE_UNAVAILABLE', ctx);

    return {
      denial,
      verified: {
        verified: true as const,
        challengeId: row.id,
        normalizedAddress: row.normalized_address,
        wallet: {
          namespace: bound.namespace,
          chainReference: bound.chainReference,
          address: bound.address,
          caip10,
        },
      },
    };
  });

  if (outcome.denial) throw outcome.denial;
  return outcome.verified;
}
