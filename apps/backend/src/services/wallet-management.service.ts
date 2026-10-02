/**
 * STEP 7 wallet management for an already authenticated customer.
 * Multiple login credentials point at the same users.id.
 * Linking does not create a user, merge accounts, or touch custody, Spot, P2P, or Forex.
 */

import { verifyTypedData } from 'ethers';
import { CaipParseError, parseCaip10, type WalletNamespace } from '../lib/caip10.js';
import {
  LINK_WALLET_ACTION,
  buildEvmActionTypedData,
  buildLinkMessage,
  buildSolanaActionMessage,
  parseEvmActionTypedData,
  parseLinkMessage,
  parseSolanaActionMessage,
  type WalletManagementAction,
} from '../lib/wallet-action-message.js';
import {
  CHALLENGE_TTL_MS,
  WalletChallengePersistError,
  authOriginFromFrontendUrl,
  formatRfc3339Seconds,
  generateWalletAuthNonce,
  truncateToSeconds,
} from './wallet-auth-challenge.service.js';
import {
  ISSUED_AT_SKEW_MS,
  verifyEvmEoaSignature,
  verifySolanaSignature,
} from './wallet-auth-verify.service.js';

const NONCE_ATTEMPTS = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WalletManagementCode =
  | 'INVALID_REQUEST'
  | 'ALREADY_LINKED'
  | 'WALLET_UNAVAILABLE'
  | 'LAST_FACTOR'
  | 'PRIMARY_REPLACEMENT_REQUIRED'
  | 'WALLET_NOT_ACTIVE'
  | 'NOT_FOUND'
  | 'INVALID_CHALLENGE'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_UNAVAILABLE'
  | 'INVALID_SIGNATURE'
  | 'ACTION_MISMATCH';

const STATUS: Record<WalletManagementCode, number> = {
  INVALID_REQUEST: 400,
  ALREADY_LINKED: 409,
  WALLET_UNAVAILABLE: 409,
  LAST_FACTOR: 409,
  PRIMARY_REPLACEMENT_REQUIRED: 409,
  WALLET_NOT_ACTIVE: 409,
  NOT_FOUND: 404,
  INVALID_CHALLENGE: 400,
  CHALLENGE_EXPIRED: 400,
  CHALLENGE_UNAVAILABLE: 400,
  INVALID_SIGNATURE: 400,
  ACTION_MISMATCH: 400,
};

const MESSAGE: Record<WalletManagementCode, string> = {
  INVALID_REQUEST: 'Invalid request',
  ALREADY_LINKED: 'This wallet is already linked to your account.',
  WALLET_UNAVAILABLE: 'This wallet cannot be linked.',
  LAST_FACTOR: 'Add another sign-in method before removing this wallet.',
  PRIMARY_REPLACEMENT_REQUIRED: 'Set another wallet as your primary sign-in wallet before removing this one.',
  WALLET_NOT_ACTIVE: 'This wallet cannot be used for that action.',
  NOT_FOUND: 'Wallet not found.',
  INVALID_CHALLENGE: 'Invalid challenge',
  CHALLENGE_EXPIRED: 'Expired challenge',
  CHALLENGE_UNAVAILABLE: 'Challenge unavailable',
  INVALID_SIGNATURE: 'Invalid signature',
  ACTION_MISMATCH: 'This authorization does not match the requested action.',
};

export class WalletManagementError extends Error {
  readonly code: WalletManagementCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly challengeId?: string;
  readonly walletId?: string;
  readonly namespace?: string;
  readonly chainReference?: string;

  constructor(
    code: WalletManagementCode,
    context?: {
      challengeId?: string;
      walletId?: string;
      namespace?: string;
      chainReference?: string;
    }
  ) {
    super(code);
    this.name = 'WalletManagementError';
    this.code = code;
    this.status = STATUS[code];
    this.publicMessage = MESSAGE[code];
    this.challengeId = context?.challengeId;
    this.walletId = context?.walletId;
    this.namespace = context?.namespace;
    this.chainReference = context?.chainReference;
  }
}

export type PublicWallet = {
  id: string;
  namespace: WalletNamespace;
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

export type WalletAuditEvent = {
  action: 'wallet_link' | 'wallet_set_primary' | 'wallet_unlink' | 'wallet_step_up_success' | 'wallet_step_up_failure';
  outcome: 'success' | 'failure' | 'already_linked';
  walletId?: string;
  namespace?: string;
  chainReference?: string;
  challengeId?: string;
  messageSha256?: string;
};

// Parameter names document the query contract. They match ChallengeQuery.
/* eslint-disable no-unused-vars */
export type ManagementQuery = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: Array<Record<string, unknown>> }>;

export type ManagementTransaction = <T>(fn: (query: ManagementQuery) => Promise<T>) => Promise<T>;
/* eslint-enable no-unused-vars */

type WalletRow = {
  id: string;
  user_id: string;
  namespace: string;
  chain_reference: string;
  address: string;
  normalized_address: string;
  provider: string | null;
  wallet_type: string;
  is_primary: boolean;
  is_verified: boolean;
  verified_at: Date | string | null;
  linked_at: Date | string | null;
  last_used_at: Date | string | null;
  status: string;
};

type ChallengeRow = {
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
};

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function iso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  return asDate(value).toISOString();
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

function bool(value: unknown): boolean {
  return value === true;
}

function countFrom(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) return +value;
  return 0;
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

function toPublic(row: WalletRow): PublicWallet {
  const namespace: WalletNamespace = row.namespace === 'solana' ? 'solana' : 'eip155';
  return {
    id: row.id,
    namespace,
    chainReference: row.chain_reference,
    address: row.address,
    provider: row.provider,
    walletType: row.wallet_type,
    isPrimary: row.is_primary,
    isVerified: row.is_verified,
    verifiedAt: iso(row.verified_at),
    linkedAt: iso(row.linked_at),
    lastUsedAt: iso(row.last_used_at),
    status: row.status,
  };
}

function mapWallet(row: Record<string, unknown>): WalletRow {
  return {
    id: text(row.id),
    user_id: text(row.user_id),
    namespace: text(row.namespace),
    chain_reference: text(row.chain_reference),
    address: text(row.address),
    normalized_address: text(row.normalized_address),
    provider: row.provider == null ? null : text(row.provider),
    wallet_type: text(row.wallet_type),
    is_primary: bool(row.is_primary),
    is_verified: bool(row.is_verified),
    verified_at: (row.verified_at as Date | string | null) ?? null,
    linked_at: (row.linked_at as Date | string | null) ?? null,
    last_used_at: (row.last_used_at as Date | string | null) ?? null,
    status: text(row.status),
  };
}

function mapChallenge(row: Record<string, unknown> | undefined): ChallengeRow | null {
  if (!row) return null;
  return {
    id: text(row.id),
    nonce: text(row.nonce),
    namespace: text(row.namespace),
    chain_reference: text(row.chain_reference),
    normalized_address: text(row.normalized_address),
    domain: text(row.domain),
    message: text(row.message),
    expires_at: row.expires_at as Date | string,
    consumed_at: (row.consumed_at as Date | string | null) ?? null,
    user_id: row.user_id == null ? null : text(row.user_id),
  };
}

const WALLET_COLUMNS = `id, user_id, namespace, chain_reference, address, normalized_address, provider,
  wallet_type, is_primary, is_verified, verified_at, linked_at, last_used_at, status`;

async function lockChallenge(query: ManagementQuery, challengeId: string, now: Date, userId: string): Promise<ChallengeRow> {
  if (!UUID_PATTERN.test(challengeId)) throw new WalletManagementError('INVALID_CHALLENGE');
  const found = await query(
    `SELECT id, nonce, namespace, chain_reference, normalized_address, domain, message,
            expires_at, consumed_at, user_id
     FROM wallet_auth_challenges
     WHERE id = $1::uuid
     FOR UPDATE`,
    [challengeId]
  );
  const row = mapChallenge(found.rows[0]);
  if (!row) throw new WalletManagementError('INVALID_CHALLENGE');
  if (row.consumed_at != null) throw new WalletManagementError('CHALLENGE_UNAVAILABLE');
  if (asDate(row.expires_at).getTime() <= now.getTime()) throw new WalletManagementError('CHALLENGE_EXPIRED');
  if (row.user_id == null || row.user_id !== userId) throw new WalletManagementError('CHALLENGE_UNAVAILABLE');
  return row;
}

async function consumeChallenge(query: ManagementQuery, row: ChallengeRow, now: Date, userId: string): Promise<void> {
  const consumed = await query(
    `UPDATE wallet_auth_challenges
     SET consumed_at = $2
     WHERE id = $1::uuid
       AND consumed_at IS NULL
       AND expires_at > $3
       AND user_id = $4::uuid
     RETURNING id`,
    [row.id, now, now, userId]
  );
  if (consumed.rows.length !== 1) throw new WalletManagementError('CHALLENGE_UNAVAILABLE');
}

function assertFreshTimes(issuedAt: string, expirationTime: string, row: ChallengeRow, now: Date): void {
  if (expirationTime !== formatRfc3339Seconds(asDate(row.expires_at))) {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  const issuedMs = Date.parse(issuedAt);
  if (!Number.isFinite(issuedMs)) throw new WalletManagementError('INVALID_CHALLENGE');
  if (issuedMs > now.getTime() + ISSUED_AT_SKEW_MS) throw new WalletManagementError('INVALID_CHALLENGE');
  if (issuedMs < now.getTime() - CHALLENGE_TTL_MS - ISSUED_AT_SKEW_MS) {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  const expiryMs = Date.parse(expirationTime);
  if (!Number.isFinite(expiryMs) || expiryMs <= issuedMs) throw new WalletManagementError('INVALID_CHALLENGE');
}

async function insertChallenge(
  query: ManagementQuery,
  values: {
    namespace: string;
    chainReference: string;
    normalizedAddress: string;
    domain: string;
    // eslint-disable-next-line no-unused-vars
    messageForNonce: (nonce: string) => string;
    expires: Date;
    userId: string;
  }
): Promise<{ id: string; nonce: string; message: string; expiresAt: string }> {
  for (let attempt = 0; attempt < NONCE_ATTEMPTS; attempt += 1) {
    const nonce = generateWalletAuthNonce();
    const message = values.messageForNonce(nonce);
    try {
      const inserted = await query(
        `INSERT INTO wallet_auth_challenges (
           nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::uuid)
         RETURNING id, nonce, message, expires_at, user_id`,
        [
          nonce,
          values.namespace,
          values.chainReference,
          values.normalizedAddress,
          values.domain,
          message,
          values.expires,
          values.userId,
        ]
      );
      const row = inserted.rows[0];
      if (!row || text(row.message) !== message || text(row.user_id) !== values.userId) {
        throw new WalletChallengePersistError();
      }
      return {
        id: text(row.id),
        nonce: text(row.nonce),
        message: text(row.message),
        expiresAt: formatRfc3339Seconds(asDate(row.expires_at as Date | string)),
      };
    } catch (err) {
      if (err instanceof WalletChallengePersistError) throw err;
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new WalletChallengePersistError();
}

export async function listUserWallets(userId: string, query: ManagementQuery): Promise<PublicWallet[]> {
  const result = await query(
    `SELECT ${WALLET_COLUMNS}
     FROM user_wallets
     WHERE user_id = $1::uuid
     ORDER BY
       CASE
         WHEN status = 'active' AND is_primary THEN 0
         WHEN status = 'active' THEN 1
         ELSE 2
       END,
       linked_at DESC NULLS LAST,
       created_at DESC`,
    [userId]
  );
  return result.rows.map((row) => toPublic(mapWallet(row)));
}

export async function createWalletLinkChallenge(input: {
  userId: string;
  caip10: string;
  provider: string | null;
  frontendUrl: string;
  query: ManagementQuery;
  now?: Date;
}): Promise<{
  id: string;
  message: string;
  namespace: WalletNamespace;
  chainReference: string;
  address: string;
  expiresAt: string;
  signing: 'personal';
}> {
  let parsed;
  try {
    parsed = parseCaip10(input.caip10);
  } catch (err) {
    if (err instanceof CaipParseError) throw new WalletManagementError('INVALID_REQUEST');
    throw err;
  }
  const origin = authOriginFromFrontendUrl(input.frontendUrl);
  const issued = truncateToSeconds(input.now ?? new Date());
  const expires = new Date(issued.getTime() + CHALLENGE_TTL_MS);
  const issuedAt = formatRfc3339Seconds(issued);
  const expirationTime = formatRfc3339Seconds(expires);
  const stored = await insertChallenge(input.query, {
    namespace: parsed.namespace,
    chainReference: parsed.chainReference,
    normalizedAddress: parsed.normalizedAddress,
    domain: origin.domain,
    expires,
    userId: input.userId,
    messageForNonce: (nonce) => buildLinkMessage({
      namespace: parsed.namespace,
      domain: origin.domain,
      address: parsed.address,
      uri: origin.uri,
      chainReference: parsed.chainReference,
      nonce,
      issuedAt,
      expirationTime,
      userId: input.userId,
      provider: input.provider,
    }),
  });
  return {
    id: stored.id,
    message: stored.message,
    namespace: parsed.namespace,
    chainReference: parsed.chainReference,
    address: parsed.address,
    expiresAt: stored.expiresAt,
    signing: 'personal',
  };
}

async function lockUserWallets(query: ManagementQuery, userId: string): Promise<WalletRow[]> {
  const result = await query(
    `SELECT ${WALLET_COLUMNS}
     FROM user_wallets
     WHERE user_id = $1::uuid
     ORDER BY id
     FOR UPDATE`,
    [userId]
  );
  return result.rows.map((row) => mapWallet(row));
}

async function findWalletByAddress(
  query: ManagementQuery,
  namespace: string,
  normalizedAddress: string
): Promise<WalletRow | null> {
  const result = await query(
    `SELECT ${WALLET_COLUMNS}
     FROM user_wallets
     WHERE namespace = $1 AND normalized_address = $2
     FOR UPDATE`,
    [namespace, normalizedAddress]
  );
  const row = result.rows[0];
  return row ? mapWallet(row) : null;
}

async function insertWallet(
  query: ManagementQuery,
  fields: {
    userId: string;
    namespace: string;
    chainReference: string;
    address: string;
    normalizedAddress: string;
    caip10: string;
    provider: string | null;
    isPrimary: boolean;
    now: Date;
  }
): Promise<WalletRow | 'conflict'> {
  await query('SAVEPOINT wallet_link_insert', []);
  try {
    const inserted = await query(
      `INSERT INTO user_wallets (
         user_id, namespace, chain_reference, address, normalized_address, caip10,
         wallet_type, provider, is_primary, is_verified, verified_at, linked_at, status
       ) VALUES (
         $1::uuid, $2, $3, $4, $5, $6,
         'eoa', $7, $8, TRUE, $9, $9, 'active'
       )
       RETURNING ${WALLET_COLUMNS}`,
      [
        fields.userId,
        fields.namespace,
        fields.chainReference,
        fields.address,
        fields.normalizedAddress,
        fields.caip10,
        fields.provider,
        fields.isPrimary,
        fields.now,
      ]
    );
    await query('RELEASE SAVEPOINT wallet_link_insert', []);
    const row = inserted.rows[0];
    if (!row) throw new WalletManagementError('INVALID_REQUEST');
    return mapWallet(row);
  } catch (err) {
    await query('ROLLBACK TO SAVEPOINT wallet_link_insert', []);
    if (!isUniqueViolation(err)) throw err;
    return 'conflict';
  }
}

function ownershipDecision(existing: WalletRow, userId: string): 'already_linked' | 'unavailable' {
  if (existing.user_id === userId && existing.status === 'active') return 'already_linked';
  return 'unavailable';
}

export async function verifyWalletLink(input: {
  userId: string;
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  now?: Date;
  transaction: ManagementTransaction;
}): Promise<{ wallet: PublicWallet; alreadyLinked: boolean; audit: WalletAuditEvent[] }> {
  const now = input.now ?? new Date();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }

  const outcome = await input.transaction(async (query) => {
    const row = await lockChallenge(query, input.challengeId, now, input.userId);
    if (input.message !== row.message) throw new WalletManagementError('INVALID_CHALLENGE');
    const parsed = parseLinkMessage(input.message);
    if (!parsed) throw new WalletManagementError('INVALID_CHALLENGE');
    if (parsed.namespace !== row.namespace) throw new WalletManagementError('INVALID_CHALLENGE');
    if (parsed.domain !== row.domain || parsed.domain !== origin.domain || parsed.uri !== origin.uri) {
      throw new WalletManagementError('INVALID_CHALLENGE');
    }
    if (parsed.chainReference !== row.chain_reference) throw new WalletManagementError('INVALID_CHALLENGE');
    if (parsed.nonce !== row.nonce) throw new WalletManagementError('INVALID_CHALLENGE');
    if (parsed.userId !== input.userId) throw new WalletManagementError('INVALID_CHALLENGE');
    assertFreshTimes(parsed.issuedAt, parsed.expirationTime, row, now);
    const normalized = parsed.namespace === 'eip155' ? parsed.address.toLowerCase() : parsed.address;
    if (normalized !== row.normalized_address) throw new WalletManagementError('INVALID_CHALLENGE');

    const signatureOk = parsed.namespace === 'eip155'
      ? verifyEvmEoaSignature(input.message, input.signature, row.normalized_address)
      : verifySolanaSignature(input.message, input.signature, parsed.address);
    if (!signatureOk) throw new WalletManagementError('INVALID_SIGNATURE');

    await lockUserWallets(query, input.userId);
    let existing = await findWalletByAddress(query, parsed.namespace, row.normalized_address);
    let decision: 'already_linked' | 'unavailable' | 'created' = existing
      ? ownershipDecision(existing, input.userId)
      : 'created';
    let wallet = existing;

    if (decision === 'created') {
      const active = await query(
        `SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1::uuid AND status = 'active'`,
        [input.userId]
      );
      const activeCount = countFrom(active.rows[0]?.n);
      const caip10 = `${parsed.namespace}:${parsed.chainReference}:${parsed.address}`;
      const inserted = await insertWallet(query, {
        userId: input.userId,
        namespace: parsed.namespace,
        chainReference: parsed.chainReference,
        address: parsed.address,
        normalizedAddress: row.normalized_address,
        caip10,
        provider: parsed.provider,
        isPrimary: activeCount === 0,
        now,
      });
      if (inserted === 'conflict') {
        existing = await findWalletByAddress(query, parsed.namespace, row.normalized_address);
        if (!existing) throw new WalletManagementError('WALLET_UNAVAILABLE');
        decision = ownershipDecision(existing, input.userId);
        wallet = existing;
      } else {
        wallet = inserted;
      }
    }

    await consumeChallenge(query, row, now, input.userId);
    if (!wallet) throw new WalletManagementError('WALLET_UNAVAILABLE');
    return {
      decision,
      wallet: toPublic(wallet),
      namespace: parsed.namespace,
      chainReference: parsed.chainReference,
      challengeId: row.id,
    };
  });

  if (outcome.decision === 'unavailable') {
    throw new WalletManagementError('WALLET_UNAVAILABLE', {
      challengeId: outcome.challengeId,
      namespace: outcome.namespace,
      chainReference: outcome.chainReference,
    });
  }
  const alreadyLinked = outcome.decision === 'already_linked';
  const audit: WalletAuditEvent[] = [{
    action: 'wallet_link',
    outcome: alreadyLinked ? 'already_linked' : 'success',
    walletId: outcome.wallet.id,
    namespace: outcome.namespace,
    chainReference: outcome.chainReference,
    challengeId: outcome.challengeId,
  }];
  if (alreadyLinked) {
    return { wallet: outcome.wallet, alreadyLinked: true, audit };
  }
  return { wallet: outcome.wallet, alreadyLinked: false, audit };
}

async function loadOwnedWallet(query: ManagementQuery, userId: string, walletId: string): Promise<WalletRow> {
  if (!UUID_PATTERN.test(walletId)) throw new WalletManagementError('NOT_FOUND');
  const result = await query(
    `SELECT ${WALLET_COLUMNS}
     FROM user_wallets
     WHERE id = $1::uuid AND user_id = $2::uuid
     FOR UPDATE`,
    [walletId, userId]
  );
  const row = result.rows[0];
  if (!row) throw new WalletManagementError('NOT_FOUND');
  return mapWallet(row);
}

export async function createWalletStepUp(input: {
  userId: string;
  walletId: string;
  action: WalletManagementAction;
  frontendUrl: string;
  now?: Date;
  transaction: ManagementTransaction;
}): Promise<{
  id: string;
  message: string;
  namespace: WalletNamespace;
  chainReference: string;
  address: string;
  expiresAt: string;
  signing: 'personal' | 'typed_data';
  action: WalletManagementAction;
}> {
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletManagementError('INVALID_REQUEST');
  }
  const issued = truncateToSeconds(input.now ?? new Date());
  const expires = new Date(issued.getTime() + CHALLENGE_TTL_MS);
  const issuedAt = formatRfc3339Seconds(issued);
  const expirationTime = formatRfc3339Seconds(expires);

  return input.transaction(async (query) => {
  const wallet = await loadOwnedWallet(query, input.userId, input.walletId);
  if (wallet.status !== 'active') throw new WalletManagementError('WALLET_NOT_ACTIVE');
  const namespace: WalletNamespace = wallet.namespace === 'solana' ? 'solana' : 'eip155';

  const stored = await insertChallenge(query, {
    namespace,
    chainReference: wallet.chain_reference,
    normalizedAddress: wallet.normalized_address,
    domain: origin.domain,
    expires,
    userId: input.userId,
    messageForNonce: (nonce) => {
      if (namespace === 'eip155') {
        const typed = buildEvmActionTypedData({
          action: input.action,
          userId: input.userId,
          targetWalletId: wallet.id,
          targetAddress: wallet.address,
          chainReference: wallet.chain_reference,
          nonce,
          issuedAt,
          expiry: expirationTime,
          origin: origin.uri,
        });
        if (!typed) throw new WalletManagementError('INVALID_REQUEST');
        return typed.json;
      }
      return buildSolanaActionMessage({
        domain: origin.domain,
        address: wallet.address,
        uri: origin.uri,
        chainReference: wallet.chain_reference,
        nonce,
        issuedAt,
        expirationTime,
        userId: input.userId,
        action: input.action,
        walletId: wallet.id,
      });
    },
  });

  return {
    id: stored.id,
    message: stored.message,
    namespace,
    chainReference: wallet.chain_reference,
    address: wallet.address,
    expiresAt: stored.expiresAt,
    signing: namespace === 'eip155' ? 'typed_data' as const : 'personal' as const,
    action: input.action,
  };
  });
}

function verifyActionProof(input: {
  row: ChallengeRow;
  message: string;
  signature: string;
  userId: string;
  walletId: string;
  action: WalletManagementAction;
  origin: { domain: string; uri: string };
  now: Date;
}): { namespace: WalletNamespace; chainReference: string } {
  if (input.message !== input.row.message) throw new WalletManagementError('INVALID_CHALLENGE');
  if (input.row.namespace === 'eip155') {
    const typed = parseEvmActionTypedData(input.message);
    if (!typed) throw new WalletManagementError('INVALID_CHALLENGE');
    const body = typed.message;
    if (body.action !== input.action || body.targetWalletId !== input.walletId) {
      throw new WalletManagementError('ACTION_MISMATCH');
    }
    if (body.userId !== input.userId || body.userId !== input.row.user_id) {
      throw new WalletManagementError('INVALID_CHALLENGE');
    }
    if (body.namespace !== 'eip155' || body.chainReference !== input.row.chain_reference) {
      throw new WalletManagementError('INVALID_CHALLENGE');
    }
    if (body.targetAddress.toLowerCase() !== input.row.normalized_address) {
      throw new WalletManagementError('INVALID_CHALLENGE');
    }
    if (body.nonce !== input.row.nonce || body.origin !== input.origin.uri) {
      throw new WalletManagementError('INVALID_CHALLENGE');
    }
    if (input.row.domain !== input.origin.domain) throw new WalletManagementError('INVALID_CHALLENGE');
    assertFreshTimes(body.issuedAt, body.expiry, input.row, input.now);
    let recovered = '';
    try {
      recovered = verifyTypedData(typed.domain, typed.types, typed.message, input.signature);
    } catch {
      throw new WalletManagementError('INVALID_SIGNATURE');
    }
    if (recovered.toLowerCase() !== input.row.normalized_address) {
      throw new WalletManagementError('INVALID_SIGNATURE');
    }
    return { namespace: 'eip155', chainReference: body.chainReference };
  }

  const parsed = parseSolanaActionMessage(input.message);
  if (!parsed) throw new WalletManagementError('INVALID_CHALLENGE');
  if (parsed.action !== input.action || parsed.walletId !== input.walletId) {
    throw new WalletManagementError('ACTION_MISMATCH');
  }
  if (parsed.userId !== input.userId || parsed.domain !== input.row.domain || parsed.domain !== input.origin.domain) {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  if (parsed.uri !== input.origin.uri || parsed.nonce !== input.row.nonce) {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  if (parsed.chainReference !== input.row.chain_reference || parsed.address !== input.row.normalized_address) {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  assertFreshTimes(parsed.issuedAt, parsed.expirationTime, input.row, input.now);
  if (!verifySolanaSignature(input.message, input.signature, parsed.address)) {
    throw new WalletManagementError('INVALID_SIGNATURE');
  }
  return { namespace: 'solana', chainReference: parsed.chainReference };
}

export async function setPrimaryWallet(input: {
  userId: string;
  walletId: string;
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  now?: Date;
  transaction: ManagementTransaction;
}): Promise<{ wallet: PublicWallet; audit: WalletAuditEvent[] }> {
  const now = input.now ?? new Date();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  const outcome = await input.transaction(async (query) => {
    const challenge = await lockChallenge(query, input.challengeId, now, input.userId);
    const bound = verifyActionProof({
      row: challenge,
      message: input.message,
      signature: input.signature,
      userId: input.userId,
      walletId: input.walletId,
      action: 'set_primary_wallet',
      origin,
      now,
    });
    const wallets = await lockUserWallets(query, input.userId);
    const target = wallets.find((item) => item.id === input.walletId);
    if (!target) throw new WalletManagementError('NOT_FOUND');
    if (target.status !== 'active') throw new WalletManagementError('WALLET_NOT_ACTIVE');
    if (target.normalized_address !== challenge.normalized_address || target.namespace !== bound.namespace) {
      throw new WalletManagementError('ACTION_MISMATCH');
    }
    await query(
      `UPDATE user_wallets
       SET is_primary = FALSE
       WHERE user_id = $1::uuid AND status = 'active' AND is_primary = TRUE`,
      [input.userId]
    );
    const updated = await query(
      `UPDATE user_wallets
       SET is_primary = TRUE
       WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'active'
       RETURNING ${WALLET_COLUMNS}`,
      [input.walletId, input.userId]
    );
    const row = updated.rows[0];
    if (!row) throw new WalletManagementError('WALLET_NOT_ACTIVE');
    await consumeChallenge(query, challenge, now, input.userId);
    return { wallet: toPublic(mapWallet(row)), challengeId: challenge.id, bound };
  });
  return {
    wallet: outcome.wallet,
    audit: [
      {
        action: 'wallet_step_up_success',
        outcome: 'success',
        walletId: outcome.wallet.id,
        namespace: outcome.bound.namespace,
        chainReference: outcome.bound.chainReference,
        challengeId: outcome.challengeId,
      },
      {
        action: 'wallet_set_primary',
        outcome: 'success',
        walletId: outcome.wallet.id,
        namespace: outcome.bound.namespace,
        chainReference: outcome.bound.chainReference,
        challengeId: outcome.challengeId,
      },
    ],
  };
}

async function hasRecoveryFactor(query: ManagementQuery, userId: string): Promise<boolean> {
  const { canUnlinkLastWallet, loadFactorSnapshot } = await import('./wallet-factor-policy.service.js');
  const snapshot = await loadFactorSnapshot(query, userId);
  return canUnlinkLastWallet(snapshot);
}

export async function unlinkWallet(input: {
  userId: string;
  walletId: string;
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  now?: Date;
  transaction: ManagementTransaction;
}): Promise<{ wallet: PublicWallet; audit: WalletAuditEvent[] }> {
  const now = input.now ?? new Date();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletManagementError('INVALID_CHALLENGE');
  }
  const outcome = await input.transaction(async (query) => {
    const challenge = await lockChallenge(query, input.challengeId, now, input.userId);
    const bound = verifyActionProof({
      row: challenge,
      message: input.message,
      signature: input.signature,
      userId: input.userId,
      walletId: input.walletId,
      action: 'unlink_wallet',
      origin,
      now,
    });
    const wallets = await lockUserWallets(query, input.userId);
    const target = wallets.find((item) => item.id === input.walletId);
    if (!target) throw new WalletManagementError('NOT_FOUND');
    if (target.status !== 'active') throw new WalletManagementError('WALLET_NOT_ACTIVE');
    if (target.normalized_address !== challenge.normalized_address || target.namespace !== bound.namespace) {
      throw new WalletManagementError('ACTION_MISMATCH');
    }
    const others = wallets.filter((item) => item.id !== target.id && item.status === 'active');
    const remainingPrimary = others.some((item) => item.is_primary);
    if (others.length > 0 && !remainingPrimary) {
      throw new WalletManagementError('PRIMARY_REPLACEMENT_REQUIRED');
    }
    if (others.length === 0 && !(await hasRecoveryFactor(query, input.userId))) {
      throw new WalletManagementError('LAST_FACTOR');
    }
    const updated = await query(
      `UPDATE user_wallets
       SET status = 'disabled', is_primary = FALSE
       WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'active'
       RETURNING ${WALLET_COLUMNS}`,
      [input.walletId, input.userId]
    );
    const row = updated.rows[0];
    if (!row) throw new WalletManagementError('WALLET_NOT_ACTIVE');
    await consumeChallenge(query, challenge, now, input.userId);
    return { wallet: toPublic(mapWallet(row)), challengeId: challenge.id, bound };
  });
  return {
    wallet: outcome.wallet,
    audit: [
      {
        action: 'wallet_step_up_success',
        outcome: 'success',
        walletId: outcome.wallet.id,
        namespace: outcome.bound.namespace,
        chainReference: outcome.bound.chainReference,
        challengeId: outcome.challengeId,
      },
      {
        action: 'wallet_unlink',
        outcome: 'success',
        walletId: outcome.wallet.id,
        namespace: outcome.bound.namespace,
        chainReference: outcome.bound.chainReference,
        challengeId: outcome.challengeId,
      },
    ],
  };
}

export { LINK_WALLET_ACTION };
