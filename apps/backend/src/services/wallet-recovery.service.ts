/**
 * Lost-wallet recovery for an existing users.id.
 * A wallet signature proves key control. It does not prove KYC.
 * Email OTP cannot attach a wallet.
 * The replacement wallet is a login credential, not a custody wallet.
 */

import { randomUUID } from 'node:crypto';
import { verifyTypedData } from 'ethers';
import { CaipParseError, parseCaip10 } from '../lib/caip10.js';
import {
  AUTHORIZE_RECOVERY_ACTION,
  MARK_COMPROMISED_ACTION,
  REPLACE_WALLET_ACTION,
  buildEvmActionTypedData,
  buildSolanaActionMessage,
  parseEvmActionTypedData,
  parseSolanaActionMessage,
  type WalletManagementAction,
} from '../lib/wallet-action-message.js';
import { adminApprovalService } from '../services/admin-approval.service.js';
import {
  CHALLENGE_TTL_MS,
  WalletChallengePersistError,
  authOriginFromFrontendUrl,
  formatRfc3339Seconds,
  generateWalletAuthNonce,
  truncateToSeconds,
} from './wallet-auth-challenge.service.js';
import { verifySolanaSignature } from './wallet-auth-verify.service.js';
import { loadFactorSnapshot, type FactorSnapshot, type PolicyQuery } from './wallet-factor-policy.service.js';
import { revokeAllExceptCurrent } from './session.service.js';

const RECOVERY_KEY = 'walletRecovery';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;
const NONCE_ATTEMPTS = 5;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OPEN_STATUSES = new Set(['REQUESTED', 'FACTOR_CHECK', 'PENDING_REVIEW', 'APPROVED', 'COOLING_OFF']);

export type RecoveryStatus =
  | 'REQUESTED'
  | 'FACTOR_CHECK'
  | 'PENDING_REVIEW'
  | 'APPROVED'
  | 'COOLING_OFF'
  | 'COMPLETED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export type RecoveryFactor = 'second_wallet' | 'passkey' | 'totp' | 'admin_kyc';

type RecoveryCase = {
  id: string;
  status: RecoveryStatus;
  factor: RecoveryFactor | null;
  replacementMode: 'strong' | 'review';
  lostWalletId: string | null;
  proposedCaip10: string | null;
  replacementWalletId: string | null;
  approvalRequestId: string | null;
  challengeId: string | null;
  cooldownUntil: string | null;
  kycStatus: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PublicRecovery = {
  id: string;
  status: RecoveryStatus;
  factor: RecoveryFactor | null;
  replacementMode: 'strong' | 'review';
  lostWalletId: string | null;
  proposedCaip10: string | null;
  replacementWalletId: string | null;
  cooldownUntil: string | null;
  withdrawalFrozen: boolean;
  kycStatus: string | null;
  factors: FactorSnapshot;
  createdAt: string;
  updatedAt: string;
};

export type RecoveryCode =
  | 'INVALID_REQUEST'
  | 'NOT_FOUND'
  | 'EMAIL_NOT_SUFFICIENT'
  | 'LAST_FACTOR'
  | 'RECOVERY_OPEN'
  | 'FACTOR_REQUIRED'
  | 'REPLACEMENT_REQUIRES_REVIEW'
  | 'WALLET_UNAVAILABLE'
  | 'INVALID_CHALLENGE'
  | 'CHALLENGE_EXPIRED'
  | 'CHALLENGE_UNAVAILABLE'
  | 'INVALID_SIGNATURE'
  | 'ACTION_MISMATCH'
  | 'COOLDOWN_ACTIVE'
  | 'KYC_REQUIRED'
  | 'APPROVAL_REQUIRED'
  | 'SELF_APPROVAL'
  | 'ALREADY_DECIDED';

const STATUS: Record<RecoveryCode, number> = {
  INVALID_REQUEST: 400,
  NOT_FOUND: 404,
  EMAIL_NOT_SUFFICIENT: 403,
  LAST_FACTOR: 409,
  RECOVERY_OPEN: 409,
  FACTOR_REQUIRED: 409,
  REPLACEMENT_REQUIRES_REVIEW: 409,
  WALLET_UNAVAILABLE: 409,
  INVALID_CHALLENGE: 400,
  CHALLENGE_EXPIRED: 400,
  CHALLENGE_UNAVAILABLE: 400,
  INVALID_SIGNATURE: 400,
  ACTION_MISMATCH: 400,
  COOLDOWN_ACTIVE: 409,
  KYC_REQUIRED: 409,
  APPROVAL_REQUIRED: 409,
  SELF_APPROVAL: 403,
  ALREADY_DECIDED: 409,
};

const MESSAGE: Record<RecoveryCode, string> = {
  INVALID_REQUEST: 'Invalid request',
  NOT_FOUND: 'Recovery request not found.',
  EMAIL_NOT_SUFFICIENT: 'Email verification cannot add or replace a sign-in wallet.',
  LAST_FACTOR: 'Add another sign-in method before removing this one.',
  RECOVERY_OPEN: 'A recovery request is already open.',
  FACTOR_REQUIRED: 'Verify a sign-in wallet, passkey, or authenticator before continuing.',
  REPLACEMENT_REQUIRES_REVIEW: 'This recovery needs review before a replacement wallet can be added.',
  WALLET_UNAVAILABLE: 'This wallet cannot be linked.',
  INVALID_CHALLENGE: 'Invalid challenge',
  CHALLENGE_EXPIRED: 'Expired challenge',
  CHALLENGE_UNAVAILABLE: 'Challenge unavailable',
  INVALID_SIGNATURE: 'Invalid signature',
  ACTION_MISMATCH: 'This authorization does not match the requested action.',
  COOLDOWN_ACTIVE: 'Wallet recovery is still in the withdrawal protection window.',
  KYC_REQUIRED: 'Approved identity verification is required before this recovery can continue.',
  APPROVAL_REQUIRED: 'A different administrator must approve this recovery.',
  SELF_APPROVAL: 'You cannot approve a recovery you started.',
  ALREADY_DECIDED: 'This recovery request is already closed.',
};

export class WalletRecoveryError extends Error {
  readonly code: RecoveryCode;
  readonly statusCode: number;
  readonly publicMessage: string;

  constructor(code: RecoveryCode) {
    super(code);
    this.name = 'WalletRecoveryError';
    this.code = code;
    this.statusCode = STATUS[code];
    this.publicMessage = MESSAGE[code];
  }
}

export type RecoveryAudit = {
  action: string;
  outcome: 'success' | 'failure';
  caseId?: string;
  walletId?: string;
  challengeId?: string;
};

export type RecoveryQuery = PolicyQuery;

/* eslint-disable no-unused-vars */
export type RecoveryTransaction = <T>(fn: (query: RecoveryQuery) => Promise<T>) => Promise<T>;

type PasskeyVerifier = (input: {
  userId: string;
  passkeyId: string;
  challenge: string;
  assertion: unknown;
}) => Promise<boolean>;
/* eslint-enable no-unused-vars */

let recoveryClock: () => Date = () => new Date();
let passkeyVerifierForTests: PasskeyVerifier | null = null;

export function setWalletRecoveryClockForTests(fn: (() => Date) | null): void {
  if (process.env.NODE_ENV !== 'test') return;
  recoveryClock = fn ?? (() => new Date());
}

export function setPasskeyRecoveryVerifierForTests(fn: PasskeyVerifier | null): void {
  if (process.env.NODE_ENV !== 'test') return;
  passkeyVerifierForTests = fn;
}

function nowDate(): Date {
  return recoveryClock();
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  return {};
}

function readCase(preferences: unknown): RecoveryCase | null {
  const raw = asRecord(preferences)[RECOVERY_KEY];
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as RecoveryCase;
  if (!row.id || !row.status) return null;
  return row;
}

function openCase(preferences: unknown): RecoveryCase | null {
  const row = readCase(preferences);
  if (!row || !OPEN_STATUSES.has(row.status)) return null;
  return row;
}

async function lockPreferences(query: RecoveryQuery, userId: string): Promise<Record<string, unknown>> {
  const result = await query(
    `SELECT preferences FROM users WHERE id = $1::uuid AND deleted_at IS NULL FOR UPDATE`,
    [userId]
  );
  if (!result.rows[0]) throw new WalletRecoveryError('NOT_FOUND');
  return asRecord(result.rows[0].preferences);
}

async function saveCase(query: RecoveryQuery, userId: string, recoveryCase: RecoveryCase): Promise<void> {
  await query(
    `UPDATE users
     SET preferences = jsonb_set(COALESCE(preferences, '{}'::jsonb), '{walletRecovery}', $2::jsonb, true),
         updated_at = NOW()
     WHERE id = $1::uuid`,
    [userId, JSON.stringify(recoveryCase)]
  );
}

async function kycStatus(query: RecoveryQuery, userId: string): Promise<string | null> {
  const result = await query(
    `SELECT status FROM kyc_applications WHERE user_id = $1::uuid ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [userId]
  );
  const status = result.rows[0]?.status;
  return typeof status === 'string' ? status : null;
}

async function withdrawalFrozen(query: RecoveryQuery, userId: string): Promise<boolean> {
  const result = await query(
    `SELECT withdrawals_frozen_at FROM users WHERE id = $1::uuid`,
    [userId]
  );
  return result.rows[0]?.withdrawals_frozen_at != null;
}

export async function getRecoveryView(input: {
  userId: string;
  query: RecoveryQuery;
}): Promise<PublicRecovery | null> {
  const prefs = await input.query(
    `SELECT preferences FROM users WHERE id = $1::uuid AND deleted_at IS NULL`,
    [input.userId]
  );
  if (!prefs.rows[0]) throw new WalletRecoveryError('NOT_FOUND');
  const recoveryCase = readCase(prefs.rows[0].preferences);
  const factors = await loadFactorSnapshot(input.query, input.userId);
  if (!recoveryCase) return null;
  return {
    id: recoveryCase.id,
    status: recoveryCase.status,
    factor: recoveryCase.factor,
    replacementMode: recoveryCase.replacementMode,
    lostWalletId: recoveryCase.lostWalletId,
    proposedCaip10: recoveryCase.proposedCaip10,
    replacementWalletId: recoveryCase.replacementWalletId,
    cooldownUntil: recoveryCase.cooldownUntil,
    withdrawalFrozen: await withdrawalFrozen(input.query, input.userId),
    kycStatus: recoveryCase.kycStatus,
    factors,
    createdAt: recoveryCase.createdAt,
    updatedAt: recoveryCase.updatedAt,
  };
}

export async function requestRecovery(input: {
  userId: string;
  lostWalletId?: string | null;
  transaction: RecoveryTransaction;
}): Promise<{ recovery: PublicRecovery; audit: RecoveryAudit }> {
  const now = nowDate();
  const recovery = await input.transaction(async (query) => {
    const prefs = await lockPreferences(query, input.userId);
    if (openCase(prefs)) throw new WalletRecoveryError('RECOVERY_OPEN');
    let lostWalletId: string | null = null;
    if (input.lostWalletId) {
      if (!UUID_PATTERN.test(input.lostWalletId)) throw new WalletRecoveryError('INVALID_REQUEST');
      const owned = await query(
        `SELECT id, status FROM user_wallets WHERE id = $1::uuid AND user_id = $2::uuid`,
        [input.lostWalletId, input.userId]
      );
      if (!owned.rows[0]) throw new WalletRecoveryError('NOT_FOUND');
      lostWalletId = input.lostWalletId;
    }
    const created: RecoveryCase = {
      id: randomUUID(),
      status: 'REQUESTED',
      factor: null,
      replacementMode: 'review',
      lostWalletId,
      proposedCaip10: null,
      replacementWalletId: null,
      approvalRequestId: null,
      challengeId: null,
      cooldownUntil: null,
      kycStatus: await kycStatus(query, input.userId),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await saveCase(query, input.userId, created);
    const factors = await loadFactorSnapshot(query, input.userId);
    const frozen = await withdrawalFrozen(query, input.userId);
    return publicFrom(created, factors, frozen);
  });
  return {
    recovery,
    audit: { action: 'recovery_requested', outcome: 'success', caseId: recovery.id, walletId: recovery.lostWalletId ?? undefined },
  };
}

function publicFrom(recoveryCase: RecoveryCase, factors: FactorSnapshot, frozen: boolean): PublicRecovery {
  return {
    id: recoveryCase.id,
    status: recoveryCase.status,
    factor: recoveryCase.factor,
    replacementMode: recoveryCase.replacementMode,
    lostWalletId: recoveryCase.lostWalletId,
    proposedCaip10: recoveryCase.proposedCaip10,
    replacementWalletId: recoveryCase.replacementWalletId,
    cooldownUntil: recoveryCase.cooldownUntil,
    withdrawalFrozen: frozen,
    kycStatus: recoveryCase.kycStatus,
    factors,
    createdAt: recoveryCase.createdAt,
    updatedAt: recoveryCase.updatedAt,
  };
}

async function requireOpen(query: RecoveryQuery, userId: string, caseId?: string): Promise<{ prefs: Record<string, unknown>; recoveryCase: RecoveryCase }> {
  const prefs = await lockPreferences(query, userId);
  const recoveryCase = openCase(prefs);
  if (!recoveryCase) throw new WalletRecoveryError('NOT_FOUND');
  if (caseId && recoveryCase.id !== caseId) throw new WalletRecoveryError('NOT_FOUND');
  return { prefs, recoveryCase };
}

function touch(recoveryCase: RecoveryCase, patch: Partial<RecoveryCase>): RecoveryCase {
  return { ...recoveryCase, ...patch, updatedAt: nowDate().toISOString() };
}

export async function verifyRecoveryFactor(input: {
  userId: string;
  factor: 'second_wallet' | 'passkey' | 'totp' | 'email';
  challengeId?: string;
  message?: string;
  signature?: string;
  passkeyId?: string;
  assertion?: unknown;
  totpCode?: string;
  frontendUrl: string;
  transaction: RecoveryTransaction;
}): Promise<{ recovery: RecoveryCase; audit: RecoveryAudit }> {
  if (input.factor === 'email') {
    throw new WalletRecoveryError('EMAIL_NOT_SUFFICIENT');
  }
  const now = nowDate();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletRecoveryError('INVALID_CHALLENGE');
  }
  const recoveryCase = await input.transaction(async (query) => {
    const { recoveryCase: current } = await requireOpen(query, input.userId);
    if (current.status !== 'REQUESTED' && current.status !== 'FACTOR_CHECK') {
      throw new WalletRecoveryError('ALREADY_DECIDED');
    }
    if (input.factor === 'totp') {
      const { verifyUser2FA } = await import('../lib/totp-verify.js');
      const ok = await verifyUser2FA(input.userId, input.totpCode ?? '');
      if (!ok) throw new WalletRecoveryError('INVALID_SIGNATURE');
      const next = touch(current, { status: 'FACTOR_CHECK', factor: 'totp', replacementMode: 'review' });
      await saveCase(query, input.userId, next);
      return next;
    }
    if (input.factor === 'passkey') {
      const passkeyId = input.passkeyId ?? '';
      if (!UUID_PATTERN.test(passkeyId)) throw new WalletRecoveryError('INVALID_REQUEST');
      const owned = await query(
        `SELECT id FROM user_passkeys WHERE id = $1::uuid AND user_id = $2::uuid AND deleted_at IS NULL`,
        [passkeyId, input.userId]
      );
      if (!owned.rows[0]) throw new WalletRecoveryError('FACTOR_REQUIRED');
      const challenge = input.message ?? '';
      if (!challenge || challenge.length < 16) throw new WalletRecoveryError('INVALID_CHALLENGE');
      const verified = await verifyPasskey({
        userId: input.userId,
        passkeyId,
        challenge,
        assertion: input.assertion,
      });
      if (!verified) throw new WalletRecoveryError('INVALID_SIGNATURE');
      const next = touch(current, { status: 'FACTOR_CHECK', factor: 'passkey', replacementMode: 'strong' });
      await saveCase(query, input.userId, next);
      return next;
    }
    const proof = await verifyRecoverySignature(query, {
      userId: input.userId,
      challengeId: input.challengeId ?? '',
      message: input.message ?? '',
      signature: input.signature ?? '',
      action: AUTHORIZE_RECOVERY_ACTION,
      origin,
      now,
      caseId: current.id,
    });
    const signer = await query(
      `SELECT id, status FROM user_wallets
       WHERE user_id = $1::uuid AND namespace = $2 AND normalized_address = $3`,
      [input.userId, proof.namespace, proof.normalizedAddress]
    );
    const wallet = signer.rows[0];
    if (!wallet || wallet.status !== 'active') throw new WalletRecoveryError('FACTOR_REQUIRED');
    if (current.lostWalletId && wallet.id === current.lostWalletId) throw new WalletRecoveryError('FACTOR_REQUIRED');
    await consumeChallenge(query, proof.challengeId, now, input.userId);
    const next = touch(current, { status: 'FACTOR_CHECK', factor: 'second_wallet', replacementMode: 'strong' });
    await saveCase(query, input.userId, next);
    return next;
  });
  return {
    recovery: recoveryCase,
    audit: { action: 'recovery_factor_verified', outcome: 'success', caseId: recoveryCase.id },
  };
}

async function verifyPasskey(input: {
  userId: string;
  passkeyId: string;
  challenge: string;
  assertion: unknown;
}): Promise<boolean> {
  if (process.env.NODE_ENV === 'test' && passkeyVerifierForTests) {
    return passkeyVerifierForTests(input);
  }
  if (!input.assertion || typeof input.assertion !== 'object') return false;
  const credential = input.assertion as { id?: string; response?: unknown };
  if (!credential.id || !credential.response) return false;
  try {
    const { redis } = await import('../lib/redis.js');
    const { db } = await import('../lib/database.js');
    const stored = await redis.get(`passkey_auth_challenge:${input.challenge}`);
    if (!stored) return false;
    const parsed = JSON.parse(stored) as { userId?: string };
    if (parsed.userId !== input.userId) return false;
    const passkeyResult = await db.query<{
      id: string;
      public_key: string;
      counter: number;
    }>(
      `SELECT id, public_key, counter
       FROM user_passkeys
       WHERE id = $1::uuid AND user_id = $2::uuid AND credential_id = $3 AND deleted_at IS NULL`,
      [input.passkeyId, input.userId, credential.id]
    );
    const passkey = passkeyResult.rows[0];
    if (!passkey) return false;
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
    const { isoBase64URL } = await import('@simplewebauthn/server/helpers');
    const rpId = process.env.WEBAUTHN_RP_ID || 'localhost';
    const origin = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';
    const verification = await verifyAuthenticationResponse({
      response: input.assertion as import('@simplewebauthn/server').AuthenticationResponseJSON,
      expectedChallenge: input.challenge,
      expectedOrigin: origin,
      expectedRPID: rpId,
      credential: {
        id: credential.id,
        publicKey: isoBase64URL.toBuffer(passkey.public_key),
        counter: passkey.counter,
      },
      requireUserVerification: true,
    });
    if (!verification.verified) return false;
    const nextCounter = verification.authenticationInfo.newCounter;
    if (passkey.counter > 0 && nextCounter <= passkey.counter) return false;
    await db.query(
      `UPDATE user_passkeys
       SET counter = $1, last_used_at = CURRENT_TIMESTAMP
       WHERE id = $2::uuid AND user_id = $3::uuid AND deleted_at IS NULL`,
      [nextCounter, passkey.id, input.userId]
    );
    await redis.del(`passkey_auth_challenge:${input.challenge}`);
    return true;
  } catch {
    return false;
  }
}

type Proof = {
  challengeId: string;
  namespace: string;
  normalizedAddress: string;
  chainReference: string;
  action: WalletManagementAction;
  targetWalletId: string;
};

async function verifyRecoverySignature(
  query: RecoveryQuery,
  input: {
    userId: string;
    challengeId: string;
    message: string;
    signature: string;
    action: WalletManagementAction;
    origin: { domain: string; uri: string };
    now: Date;
    caseId: string;
    lostWalletId?: string | null;
  }
): Promise<Proof> {
  if (!UUID_PATTERN.test(input.challengeId)) throw new WalletRecoveryError('INVALID_CHALLENGE');
  const found = await query(
    `SELECT id, nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id
     FROM wallet_auth_challenges WHERE id = $1::uuid FOR UPDATE`,
    [input.challengeId]
  );
  const row = found.rows[0];
  if (!row) throw new WalletRecoveryError('INVALID_CHALLENGE');
  if (String(row.user_id ?? '').toLowerCase() !== input.userId.toLowerCase()) {
    throw new WalletRecoveryError('CHALLENGE_UNAVAILABLE');
  }
  if (row.consumed_at != null) throw new WalletRecoveryError('CHALLENGE_UNAVAILABLE');
  if (new Date(String(row.expires_at)).getTime() <= input.now.getTime()) throw new WalletRecoveryError('CHALLENGE_EXPIRED');
  if (input.message !== row.message) throw new WalletRecoveryError('INVALID_CHALLENGE');
  const evm = parseEvmActionTypedData(input.message);
  const solana = evm ? null : parseSolanaActionMessage(input.message);
  const action = evm?.message.action ?? solana?.action;
  const targetWalletId = evm?.message.targetWalletId ?? solana?.walletId;
  const userId = evm?.message.userId ?? solana?.userId;
  const address = evm?.message.targetAddress ?? solana?.address;
  const namespace = evm ? 'eip155' : solana ? 'solana' : '';
  const chainReference = evm?.message.chainReference ?? solana?.chainReference ?? '';
  const origin = evm?.message.origin ?? solana?.uri ?? '';
  const domain = evm ? input.origin.domain : solana?.domain;
  if (!action || !targetWalletId || !userId || !address) throw new WalletRecoveryError('INVALID_CHALLENGE');
  if (action !== input.action) throw new WalletRecoveryError('ACTION_MISMATCH');
  if (userId !== input.userId) throw new WalletRecoveryError('ACTION_MISMATCH');
  if (input.action === REPLACE_WALLET_ACTION || input.action === AUTHORIZE_RECOVERY_ACTION) {
    if (targetWalletId !== input.caseId) throw new WalletRecoveryError('ACTION_MISMATCH');
  }
  if (input.action === MARK_COMPROMISED_ACTION && input.lostWalletId && targetWalletId !== input.lostWalletId) {
    throw new WalletRecoveryError('ACTION_MISMATCH');
  }
  if (domain !== row.domain || domain !== input.origin.domain) throw new WalletRecoveryError('INVALID_CHALLENGE');
  if (namespace === 'eip155' && origin !== input.origin.domain) throw new WalletRecoveryError('INVALID_CHALLENGE');
  if (namespace === 'solana' && origin !== input.origin.uri) throw new WalletRecoveryError('INVALID_CHALLENGE');
  if (namespace !== row.namespace || chainReference !== row.chain_reference) throw new WalletRecoveryError('INVALID_CHALLENGE');
  const normalized = namespace === 'eip155' ? address.toLowerCase() : address;
  if (normalized !== row.normalized_address) throw new WalletRecoveryError('INVALID_CHALLENGE');
  const ok = namespace === 'eip155'
    ? verifyTypedDataSignature(input.message, input.signature, normalized)
    : verifySolanaSignature(input.message, input.signature, address);
  if (!ok) throw new WalletRecoveryError('INVALID_SIGNATURE');
  return {
    challengeId: String(row.id),
    namespace,
    normalizedAddress: normalized,
    chainReference,
    action,
    targetWalletId,
  };
}

function verifyTypedDataSignature(message: string, signature: string, address: string): boolean {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) return false;
  const parsed = parseEvmActionTypedData(message);
  if (!parsed) return false;
  try {
    const recovered = verifyTypedData(parsed.domain, parsed.types, parsed.message, signature);
    return recovered.toLowerCase() === address.toLowerCase();
  } catch {
    return false;
  }
}

async function consumeChallenge(query: RecoveryQuery, challengeId: string, now: Date, userId: string): Promise<void> {
  const updated = await query(
    `UPDATE wallet_auth_challenges
     SET consumed_at = $2
     WHERE id = $1::uuid AND consumed_at IS NULL AND user_id = $3::uuid
     RETURNING id`,
    [challengeId, now, userId]
  );
  if (!updated.rows[0]) throw new WalletRecoveryError('CHALLENGE_UNAVAILABLE');
}

export async function createRecoveryChallenge(input: {
  userId: string;
  caip10: string;
  action: typeof AUTHORIZE_RECOVERY_ACTION | typeof MARK_COMPROMISED_ACTION | typeof REPLACE_WALLET_ACTION;
  lostWalletId?: string | null;
  frontendUrl: string;
  transaction: RecoveryTransaction;
}): Promise<{ challengeId: string; message: string; signing: 'typed_data' | 'personal'; caseId: string }> {
  const now = nowDate();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletRecoveryError('INVALID_REQUEST');
  }
  let parsed: ReturnType<typeof parseCaip10>;
  try {
    parsed = parseCaip10(input.caip10);
  } catch (err) {
    if (err instanceof CaipParseError) throw new WalletRecoveryError('INVALID_REQUEST');
    throw err;
  }
  return input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    if (input.action === REPLACE_WALLET_ACTION) {
      if (recoveryCase.replacementMode !== 'strong' && recoveryCase.status !== 'APPROVED') {
        throw new WalletRecoveryError('REPLACEMENT_REQUIRES_REVIEW');
      }
      if (recoveryCase.status !== 'FACTOR_CHECK' && recoveryCase.status !== 'APPROVED') {
        throw new WalletRecoveryError('FACTOR_REQUIRED');
      }
    }
    const targetWalletId = input.action === MARK_COMPROMISED_ACTION
      ? (input.lostWalletId ?? recoveryCase.lostWalletId ?? '')
      : recoveryCase.id;
    if (!UUID_PATTERN.test(targetWalletId)) throw new WalletRecoveryError('INVALID_REQUEST');
    const issuedAt = formatRfc3339Seconds(truncateToSeconds(now));
    const expires = new Date(now.getTime() + CHALLENGE_TTL_MS);
    const expiry = formatRfc3339Seconds(truncateToSeconds(expires));
    const messageForNonce = (nonce: string): string | null => {
      if (parsed.namespace === 'eip155') {
        return buildEvmActionTypedData({
          action: input.action,
          userId: input.userId,
          targetWalletId,
          targetAddress: parsed.address,
          chainReference: parsed.chainReference,
          nonce,
          issuedAt,
          expiry,
          origin: origin.domain,
        })?.json ?? null;
      }
      return buildSolanaActionMessage({
        domain: origin.domain,
        address: parsed.address,
        uri: origin.uri,
        chainReference: parsed.chainReference,
        nonce,
        issuedAt,
        expirationTime: expiry,
        userId: input.userId,
        action: input.action,
        walletId: targetWalletId,
      });
    };
    for (let attempt = 0; attempt < NONCE_ATTEMPTS; attempt += 1) {
      const nonce = generateWalletAuthNonce();
      const message = messageForNonce(nonce);
      if (!message) throw new WalletRecoveryError('INVALID_REQUEST');
      try {
        const inserted = await query(
          `INSERT INTO wallet_auth_challenges (
             nonce, namespace, chain_reference, normalized_address, domain, message, expires_at, consumed_at, user_id
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8::uuid)
           RETURNING id`,
          [nonce, parsed.namespace, parsed.chainReference, parsed.normalizedAddress, origin.domain, message, expires, input.userId]
        );
        const id = String(inserted.rows[0]?.id ?? '');
        if (input.action === REPLACE_WALLET_ACTION) {
          await saveCase(query, input.userId, touch(recoveryCase, {
            proposedCaip10: `${parsed.namespace}:${parsed.chainReference}:${parsed.address}`,
            challengeId: id,
          }));
        }
        return {
          challengeId: id,
          message,
          signing: parsed.namespace === 'eip155' ? 'typed_data' as const : 'personal' as const,
          caseId: recoveryCase.id,
        };
      } catch (err) {
        if (isUniqueViolation(err) || err instanceof WalletChallengePersistError) continue;
        throw err;
      }
    }
    throw new WalletRecoveryError('INVALID_REQUEST');
  });
}

export async function markWalletCompromised(input: {
  userId: string;
  lostWalletId: string;
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  sessionId?: string | null;
  transaction: RecoveryTransaction;
}): Promise<{ audit: RecoveryAudit }> {
  const now = nowDate();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletRecoveryError('INVALID_CHALLENGE');
  }
  const walletId = await input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    if (recoveryCase.factor !== 'second_wallet' && recoveryCase.factor !== 'passkey' && recoveryCase.status !== 'APPROVED') {
      throw new WalletRecoveryError('FACTOR_REQUIRED');
    }
    const proof = await verifyRecoverySignature(query, {
      userId: input.userId,
      challengeId: input.challengeId,
      message: input.message,
      signature: input.signature,
      action: MARK_COMPROMISED_ACTION,
      origin,
      now,
      caseId: recoveryCase.id,
      lostWalletId: input.lostWalletId,
    });
    const target = await query(
      `SELECT id, status, user_id FROM user_wallets WHERE id = $1::uuid AND user_id = $2::uuid FOR UPDATE`,
      [input.lostWalletId, input.userId]
    );
    if (!target.rows[0]) throw new WalletRecoveryError('NOT_FOUND');
    const signer = await query(
      `SELECT id FROM user_wallets
       WHERE user_id = $1::uuid AND namespace = $2 AND normalized_address = $3 AND status = 'active'`,
      [input.userId, proof.namespace, proof.normalizedAddress]
    );
    if (!signer.rows[0] || signer.rows[0].id === input.lostWalletId) throw new WalletRecoveryError('FACTOR_REQUIRED');
    await query(
      `UPDATE user_wallets
       SET status = 'compromised', is_primary = FALSE, updated_at = NOW()
       WHERE id = $1::uuid AND user_id = $2::uuid`,
      [input.lostWalletId, input.userId]
    );
    await consumeChallenge(query, proof.challengeId, now, input.userId);
    await saveCase(query, input.userId, touch(recoveryCase, { lostWalletId: input.lostWalletId }));
    return input.lostWalletId;
  });
  await revokeAllExceptCurrent(input.userId, input.sessionId || '00000000-0000-0000-0000-000000000000');
  return { audit: { action: 'wallet_marked_compromised', outcome: 'success', walletId } };
}

export async function verifyReplacementWallet(input: {
  userId: string;
  challengeId: string;
  message: string;
  signature: string;
  frontendUrl: string;
  sessionId?: string | null;
  transaction: RecoveryTransaction;
}): Promise<{ walletId: string; audit: RecoveryAudit }> {
  const now = nowDate();
  let origin: { domain: string; uri: string };
  try {
    origin = authOriginFromFrontendUrl(input.frontendUrl);
  } catch {
    throw new WalletRecoveryError('INVALID_CHALLENGE');
  }
  const created = await input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    if (recoveryCase.replacementMode !== 'strong' && recoveryCase.status !== 'APPROVED') {
      throw new WalletRecoveryError('REPLACEMENT_REQUIRES_REVIEW');
    }
    const proof = await verifyRecoverySignature(query, {
      userId: input.userId,
      challengeId: input.challengeId,
      message: input.message,
      signature: input.signature,
      action: REPLACE_WALLET_ACTION,
      origin,
      now,
      caseId: recoveryCase.id,
    });
    const existing = await query(
      `SELECT id, user_id, status FROM user_wallets
       WHERE namespace = $1 AND normalized_address = $2
       FOR UPDATE`,
      [proof.namespace, proof.normalizedAddress]
    );
    const row = existing.rows[0];
    if (row && row.user_id !== input.userId) throw new WalletRecoveryError('WALLET_UNAVAILABLE');
    if (row && row.user_id === input.userId && row.status === 'active') throw new WalletRecoveryError('WALLET_UNAVAILABLE');
    if (row && row.id && row.status === 'disabled' && recoveryCase.replacementWalletId === row.id) {
      throw new WalletRecoveryError('CHALLENGE_UNAVAILABLE');
    }
    const address = proof.namespace === 'eip155' ? proof.normalizedAddress : addressFromMessage(input.message);
    const caip10 = `${proof.namespace}:${proof.chainReference}:${address}`;
    if (row) throw new WalletRecoveryError('WALLET_UNAVAILABLE');
    await query('SAVEPOINT recovery_wallet_insert', []);
    let walletId = '';
    try {
      const inserted = await query(
        `INSERT INTO user_wallets (
           user_id, namespace, chain_reference, address, normalized_address, caip10,
           wallet_type, provider, is_primary, is_verified, verified_at, linked_at, status, metadata
         ) VALUES (
           $1::uuid, $2, $3, $4, $5, $6,
           'eoa', NULL, FALSE, TRUE, $7, $7, 'disabled', $8::jsonb
         )
         RETURNING id`,
        [
          input.userId,
          proof.namespace,
          proof.chainReference,
          address,
          proof.normalizedAddress,
          caip10,
          now,
          JSON.stringify({ recoveryCaseId: recoveryCase.id }),
        ]
      );
      await query('RELEASE SAVEPOINT recovery_wallet_insert', []);
      walletId = String(inserted.rows[0]?.id ?? '');
      if (!walletId) throw new WalletRecoveryError('INVALID_REQUEST');
    } catch (err) {
      if (err instanceof WalletRecoveryError) throw err;
      await query('ROLLBACK TO SAVEPOINT recovery_wallet_insert', []);
      if (isUniqueViolation(err)) throw new WalletRecoveryError('WALLET_UNAVAILABLE');
      throw err;
    }
    if (recoveryCase.lostWalletId) {
      await query(
        `UPDATE user_wallets
         SET status = 'compromised', is_primary = FALSE, updated_at = NOW()
         WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'active'`,
        [recoveryCase.lostWalletId, input.userId]
      );
    }
    const cooldownUntil = new Date(now.getTime() + COOLDOWN_MS);
    await query(
      `INSERT INTO security_cooldowns (user_id, reason, cooldown_until) VALUES ($1::uuid, 'wallet_recovery', $2)`,
      [input.userId, cooldownUntil]
    );
    await query(
      `UPDATE users
       SET withdrawals_frozen_at = COALESCE(withdrawals_frozen_at, $2),
           withdrawals_frozen_reason = COALESCE(withdrawals_frozen_reason, 'wallet_recovery')
       WHERE id = $1::uuid AND withdrawals_frozen_at IS NULL`,
      [input.userId, now]
    );
    await consumeChallenge(query, proof.challengeId, now, input.userId);
    await saveCase(query, input.userId, touch(recoveryCase, {
      status: 'COOLING_OFF',
      replacementWalletId: walletId,
      proposedCaip10: caip10,
      cooldownUntil: cooldownUntil.toISOString(),
      challengeId: proof.challengeId,
    }));
    return { walletId, caseId: recoveryCase.id, challengeId: proof.challengeId };
  });
  await revokeAllExceptCurrent(input.userId, input.sessionId || '00000000-0000-0000-0000-000000000000');
  return {
    walletId: created.walletId,
    audit: {
      action: 'recovery_cooldown_started',
      outcome: 'success',
      caseId: created.caseId,
      walletId: created.walletId,
      challengeId: created.challengeId,
    },
  };
}

function addressFromMessage(message: string): string {
  const evm = parseEvmActionTypedData(message);
  if (evm) return evm.message.targetAddress;
  const solana = parseSolanaActionMessage(message);
  return solana?.address ?? '';
}

export async function completeRecoveryCooldown(input: {
  userId: string;
  transaction: RecoveryTransaction;
}): Promise<{ walletId: string; audit: RecoveryAudit }> {
  const now = nowDate();
  const walletId = await input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    if (recoveryCase.status !== 'COOLING_OFF' || !recoveryCase.cooldownUntil || !recoveryCase.replacementWalletId) {
      throw new WalletRecoveryError('COOLDOWN_ACTIVE');
    }
    if (new Date(recoveryCase.cooldownUntil).getTime() > now.getTime()) throw new WalletRecoveryError('COOLDOWN_ACTIVE');
    const activePrimary = await query(
      `SELECT id FROM user_wallets WHERE user_id = $1::uuid AND status = 'active' AND is_primary = TRUE`,
      [input.userId]
    );
    const makePrimary = activePrimary.rows.length === 0;
    const updated = await query(
      `UPDATE user_wallets
       SET status = 'active', is_primary = $3, updated_at = NOW()
       WHERE id = $1::uuid AND user_id = $2::uuid AND status = 'disabled'
         AND metadata->>'recoveryCaseId' = $4
       RETURNING id`,
      [recoveryCase.replacementWalletId, input.userId, makePrimary, recoveryCase.id]
    );
    if (!updated.rows[0]) throw new WalletRecoveryError('WALLET_UNAVAILABLE');
    await query(
      `UPDATE security_cooldowns
       SET cooldown_until = NOW() - INTERVAL '1 second'
       WHERE user_id = $1::uuid AND reason = 'wallet_recovery' AND cooldown_until > NOW()`,
      [input.userId]
    );
    await query(
      `UPDATE users
       SET withdrawals_frozen_at = NULL, withdrawals_frozen_reason = NULL
       WHERE id = $1::uuid AND withdrawals_frozen_reason = 'wallet_recovery'`,
      [input.userId]
    );
    await saveCase(query, input.userId, touch(recoveryCase, { status: 'COMPLETED' }));
    return recoveryCase.replacementWalletId;
  });
  return { walletId, audit: { action: 'recovery_completed', outcome: 'success', walletId } };
}

export async function cancelRecovery(input: {
  userId: string;
  transaction: RecoveryTransaction;
}): Promise<{ audit: RecoveryAudit }> {
  const recoveryCase = await input.transaction(async (query) => {
    const { recoveryCase: current } = await requireOpen(query, input.userId);
    if (current.status === 'COOLING_OFF' || current.status === 'COMPLETED') throw new WalletRecoveryError('ALREADY_DECIDED');
    const next = touch(current, { status: 'CANCELLED' });
    await saveCase(query, input.userId, next);
    return next;
  });
  return { audit: { action: 'recovery_cancelled', outcome: 'success', caseId: recoveryCase.id } };
}

export async function submitTotpForReview(input: {
  userId: string;
  transaction: RecoveryTransaction;
}): Promise<{ audit: RecoveryAudit }> {
  const recoveryCase = await input.transaction(async (query) => {
    const { recoveryCase: current } = await requireOpen(query, input.userId);
    if (current.factor !== 'totp' || current.status !== 'FACTOR_CHECK') throw new WalletRecoveryError('REPLACEMENT_REQUIRES_REVIEW');
    const next = touch(current, { status: 'PENDING_REVIEW', replacementMode: 'review' });
    await saveCase(query, input.userId, next);
    return next;
  });
  return { audit: { action: 'recovery_review_started', outcome: 'success', caseId: recoveryCase.id } };
}

export async function adminOpenReview(input: {
  userId: string;
  adminId: string;
  reason: string;
  transaction: RecoveryTransaction;
}): Promise<{ approvalRequestId: string; audit: RecoveryAudit }> {
  if (!input.reason.trim()) throw new WalletRecoveryError('INVALID_REQUEST');
  const opened = await input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    if (recoveryCase.approvalRequestId) throw new WalletRecoveryError('ALREADY_DECIDED');
    const kyc = await kycStatus(query, input.userId);
    if (kyc !== 'approved') throw new WalletRecoveryError('KYC_REQUIRED');
    const next = touch(recoveryCase, { status: 'PENDING_REVIEW', kycStatus: kyc, factor: recoveryCase.factor ?? 'admin_kyc' });
    await saveCase(query, input.userId, next);
    return next;
  });
  const approval = await adminApprovalService.createRequest('wallet_recovery', {
    userId: input.userId,
    caseId: opened.id,
    reason: input.reason.trim().slice(0, 500),
    kycStatus: opened.kycStatus,
  }, input.adminId);
  await input.transaction(async (query) => {
    const { recoveryCase } = await requireOpen(query, input.userId);
    await saveCase(query, input.userId, touch(recoveryCase, { approvalRequestId: approval.id }));
  });
  return {
    approvalRequestId: approval.id,
    audit: { action: 'recovery_review_started', outcome: 'success', caseId: opened.id },
  };
}

export async function adminDecide(input: {
  userId: string;
  adminId: string;
  decision: 'approve' | 'reject';
  reason?: string;
  transaction: RecoveryTransaction;
}): Promise<{ audit: RecoveryAudit }> {
  const prefs = await input.transaction(async (query) => lockPreferences(query, input.userId));
  const recoveryCase = openCase(prefs);
  if (!recoveryCase || !recoveryCase.approvalRequestId) throw new WalletRecoveryError('APPROVAL_REQUIRED');
  if (recoveryCase.status !== 'PENDING_REVIEW') throw new WalletRecoveryError('ALREADY_DECIDED');
  if (input.decision === 'reject') {
    await adminApprovalService.rejectRequest(recoveryCase.approvalRequestId, input.adminId, input.reason);
    await input.transaction(async (query) => {
      const { recoveryCase: current } = await requireOpen(query, input.userId);
      await saveCase(query, input.userId, touch(current, { status: 'REJECTED' }));
    });
    return { audit: { action: 'recovery_rejected', outcome: 'success', caseId: recoveryCase.id } };
  }
  const result = await adminApprovalService.approveRequest(recoveryCase.approvalRequestId, input.adminId);
  if (!result.success) {
    if (result.message.toLowerCase().includes('own request')) throw new WalletRecoveryError('SELF_APPROVAL');
    throw new WalletRecoveryError('APPROVAL_REQUIRED');
  }
  if (result.request?.status !== 'approved') throw new WalletRecoveryError('APPROVAL_REQUIRED');
  await input.transaction(async (query) => {
    const { recoveryCase: current } = await requireOpen(query, input.userId);
    const kyc = await kycStatus(query, input.userId);
    if (kyc !== 'approved') throw new WalletRecoveryError('KYC_REQUIRED');
    await saveCase(query, input.userId, touch(current, {
      status: 'APPROVED',
      factor: 'admin_kyc',
      replacementMode: 'strong',
      kycStatus: kyc,
    }));
  });
  return { audit: { action: 'recovery_approved', outcome: 'success', caseId: recoveryCase.id } };
}

export function assertEmailCannotLinkWallet(): never {
  throw new WalletRecoveryError('EMAIL_NOT_SUFFICIENT');
}
