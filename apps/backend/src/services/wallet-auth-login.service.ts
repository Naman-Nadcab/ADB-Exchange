/**
 * STEP 5 wallet login.
 * A verified challenge resolves to users.id, then the caller opens the
 * existing application session. This module does not sign JWTs or set cookies.
 *
 * Identity (user + user_wallets + challenge consumption) commits in one
 * transaction. createSession runs after that commit because it writes
 * user_sessions and Redis on its own. If session creation fails, the
 * user and wallet credential stay together and the challenge stays consumed.
 * A later login needs a new challenge. No user is left without a wallet.
 */

import { encryption } from '../lib/encryption.js';
import {
  verifyWalletAuthChallenge,
  WalletAuthDenied,
  type VerifiedChallengeContext,
  type VerifyTransaction,
} from './wallet-auth-verify.service.js';

const REFERRAL_ATTEMPTS = 5;

export class WalletLoginRetry extends Error {
  constructor() {
    super('WALLET_LOGIN_RETRY');
    this.name = 'WalletLoginRetry';
  }
}

export type WalletLoginIdentity = {
  userId: string;
  walletId: string;
  createdUser: boolean;
  namespace: 'eip155' | 'solana';
  chainReference: string;
  address: string;
  normalizedAddress: string;
  caip10: string;
  challengeId: string;
  user: {
    id: string;
    email: string | null;
    phone: string | null;
    username: string | null;
    status: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    tierLevel: number;
    role: string;
  };
};

type UserRow = {
  id: string;
  email: string | null;
  phone: string | null;
  username: string | null;
  status: string;
  email_verified: boolean;
  phone_verified: boolean;
  tier_level: number | null;
  role: string;
  deleted_at: Date | string | null;
  locked_until: Date | string | null;
  is_locked: boolean;
};

const USER_RETURNING = `id, email, phone, username, status, email_verified, phone_verified, tier_level, role, deleted_at, locked_until,
       (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked`;

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505';
}

function toProfile(row: UserRow): WalletLoginIdentity['user'] {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    username: row.username,
    status: row.status,
    emailVerified: row.email_verified,
    phoneVerified: row.phone_verified,
    tierLevel: row.tier_level ?? 0,
    role: row.role,
  };
}

async function loadUser(query: VerifiedChallengeContext['query'], userId: string): Promise<UserRow> {
  const result = await query(
    `SELECT ${USER_RETURNING}
     FROM users WHERE id = $1 FOR UPDATE`,
    [userId]
  );
  const row = result.rows[0] as unknown as UserRow | undefined;
  if (!row || row.deleted_at != null) throw new WalletAuthDenied('ACCOUNT_INACTIVE', userId);
  return row;
}

function assertCustomerCanLogin(user: UserRow): void {
  if (user.role === 'admin' || user.role === 'super_admin') {
    throw new WalletAuthDenied('WALLET_UNAVAILABLE', user.id);
  }
  if (user.status !== 'active') throw new WalletAuthDenied('ACCOUNT_INACTIVE', user.id);
  if (user.is_locked) {
    const lockedUntil = user.locked_until != null ? new Date(user.locked_until) : undefined;
    throw new WalletAuthDenied('ACCOUNT_LOCKED', user.id, lockedUntil);
  }
}

async function createWalletUser(
  ctx: VerifiedChallengeContext
): Promise<{ user: UserRow; walletId: string }> {
  let lastError: unknown;
  for (let attempt = 0; attempt < REFERRAL_ATTEMPTS; attempt++) {
    const referralCode = encryption.generateReferralCode();
    await ctx.query('SAVEPOINT wallet_user_insert', []);
    try {
      const inserted = await ctx.query(
        `INSERT INTO users (
           email, password_hash, role, status, referral_code, email_verified, phone_verified
         ) VALUES (NULL, NULL, 'user', 'active', $1, FALSE, FALSE)
         RETURNING ${USER_RETURNING}`,
        [referralCode]
      );
      const user = inserted.rows[0] as unknown as UserRow | undefined;
      if (!user) throw new Error('USER_INSERT_FAILED');
      await ctx.query(
        `INSERT INTO referral_codes (user_id, code) VALUES ($1, $2)`,
        [user.id, referralCode]
      );
      const wallet = await ctx.query(
        `INSERT INTO user_wallets (
           user_id, namespace, chain_reference, address, normalized_address, caip10,
           wallet_type, provider, is_primary, is_verified, verified_at, linked_at, last_used_at, status
         ) VALUES (
           $1, $2, $3, $4, $5, $6,
           'eoa', NULL, TRUE, TRUE, $7, $7, $7, 'active'
         )
         RETURNING id`,
        [
          user.id,
          ctx.namespace,
          ctx.chainReference,
          ctx.address,
          ctx.normalizedAddress,
          ctx.caip10,
          ctx.now,
        ]
      );
      const walletId = (wallet.rows[0] as unknown as { id?: string } | undefined)?.id;
      if (!walletId) throw new Error('WALLET_INSERT_FAILED');
      await ctx.query('RELEASE SAVEPOINT wallet_user_insert', []);
      return { user, walletId };
    } catch (err) {
      await ctx.query('ROLLBACK TO SAVEPOINT wallet_user_insert', []);
      if (!isUniqueViolation(err)) throw err;
      const constraint = String((err as { constraint?: string }).constraint ?? '');
      if (constraint.includes('referral')) {
        lastError = err;
        continue;
      }
      throw new WalletLoginRetry();
    }
  }
  throw lastError instanceof Error ? lastError : new WalletLoginRetry();
}

async function resolveWalletIdentity(ctx: VerifiedChallengeContext): Promise<{
  user: UserRow;
  walletId: string;
  createdUser: boolean;
}> {
  const existing = await ctx.query(
    `SELECT id, user_id, status, is_primary
     FROM user_wallets
     WHERE namespace = $1 AND normalized_address = $2
     FOR UPDATE`,
    [ctx.namespace, ctx.normalizedAddress]
  );
  const wallet = existing.rows[0] as {
    id: string;
    user_id: string;
    status: string;
    is_primary: boolean;
  } | undefined;

  if (!wallet) {
    const created = await createWalletUser(ctx);
    ctx.assignUserId(created.user.id);
    return { user: created.user, walletId: created.walletId, createdUser: true };
  }

  ctx.assignUserId(wallet.user_id);
  if (wallet.status !== 'active') throw new WalletAuthDenied('WALLET_UNAVAILABLE', wallet.user_id);

  const user = await loadUser(ctx.query, wallet.user_id);
  assertCustomerCanLogin(user);
  await ctx.query(
    `UPDATE user_wallets
     SET last_used_at = $2, updated_at = $2
     WHERE id = $1 AND status = 'active'`,
    [wallet.id, ctx.now]
  );
  return { user, walletId: wallet.id, createdUser: false };
}

async function verifyAndResolve(input: {
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
}): Promise<WalletLoginIdentity> {
  const box: { identity?: WalletLoginIdentity } = {};
  const verified = await verifyWalletAuthChallenge({
    challengeId: input.challengeId,
    message: input.message,
    signature: input.signature,
    frontendUrl: input.frontendUrl,
    now: input.now,
    transaction: input.transaction,
    beforeSignature: input.beforeSignature,
    afterVerified: async (ctx) => {
      const resolved = await resolveWalletIdentity(ctx);
      box.identity = {
        userId: resolved.user.id,
        walletId: resolved.walletId,
        createdUser: resolved.createdUser,
        namespace: ctx.namespace,
        chainReference: ctx.chainReference,
        address: ctx.address,
        normalizedAddress: ctx.normalizedAddress,
        caip10: ctx.caip10,
        challengeId: ctx.row.id,
        user: toProfile(resolved.user),
      };
    },
  });
  if (!box.identity) throw new WalletAuthDenied('WALLET_UNAVAILABLE');
  if (
    box.identity.userId === box.identity.address
    || box.identity.userId === box.identity.normalizedAddress
    || box.identity.userId === verified.wallet.caip10
  ) {
    throw new WalletAuthDenied('WALLET_UNAVAILABLE');
  }
  return box.identity;
}

/**
 * Verify the challenge, persist identity, and consume the challenge.
 * Does not create a session. Caller uses createSession after this returns.
 * One unique-violation retry resolves a wallet inserted by a concurrent first login.
 */
export async function resolveWalletLogin(input: {
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
}): Promise<WalletLoginIdentity> {
  try {
    return await verifyAndResolve(input);
  } catch (err) {
    if (!(err instanceof WalletLoginRetry)) throw err;
  }
  return verifyAndResolve(input);
}
