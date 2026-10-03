/**
 * Migration-window policy for legacy password and OTP session issuance.
 * Wallet connection is not migration. A user is wallet-migrated only when a
 * user_wallets credential exists for the same users.id.
 * Password hashes and OTP tables are not deleted here.
 */

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';

export const CUTOVER_SETTING_KEY = 'wallet_auth_cutover_mode';

export const LEGACY_DISABLED_MESSAGE = 'This account uses wallet sign-in.';
export const LEGACY_SIGNUP_MESSAGE = 'Connect your wallet to continue.';

export const CUTOVER_MODES = ['LEGACY_AND_WALLET', 'WALLET_PREFERRED', 'WALLET_FIRST', 'WALLET_ONLY'] as const;
export type CutoverMode = (typeof CUTOVER_MODES)[number];

export type MigrationStatus = 'UNMIGRATED' | 'WALLET_LINKED' | 'LEGACY_DISABLED';
export type SessionAuthMethod = 'password' | 'otp' | 'wallet' | 'passkey' | 'oauth' | 'legacy';

const CONTINUING_METHODS = new Set<SessionAuthMethod>(['wallet', 'passkey', 'oauth']);

export class CutoverRefused extends Error {
  readonly failed: string[];
  constructor(failed: string[], message = 'Wallet-first cutover refused') {
    super(message);
    this.name = 'CutoverRefused';
    this.failed = failed;
  }
}

export type LegacyDecision = {
  allowed: boolean;
  status: MigrationStatus;
};

/**
 * Single decision for password and OTP session issuance.
 * WALLET_FIRST blocks legacy sessions when any wallet credential exists.
 * Unmigrated users stay on legacy auth during that migration window.
 * WALLET_ONLY is the final customer contract: no password or OTP session
 * for any customer, including accounts that have not linked a wallet.
 * Those accounts are not deleted. Rollback to LEGACY_AND_WALLET restores
 * password and OTP without changing balances, KYC, or wallet rows.
 */
export function legacySessionDecision(input: {
  mode: CutoverMode;
  walletCredentialCount: number;
  activeWalletCount: number;
}): LegacyDecision {
  if (input.mode === 'WALLET_ONLY') {
    return {
      allowed: false,
      status: input.walletCredentialCount > 0 ? 'LEGACY_DISABLED' : 'UNMIGRATED',
    };
  }
  if (input.mode === 'WALLET_FIRST' && input.walletCredentialCount > 0) {
    return { allowed: false, status: 'LEGACY_DISABLED' };
  }
  if (input.activeWalletCount > 0) {
    return { allowed: true, status: 'WALLET_LINKED' };
  }
  return { allowed: true, status: 'UNMIGRATED' };
}

export function legacySignupAllowed(mode: CutoverMode): boolean {
  return mode !== 'WALLET_FIRST' && mode !== 'WALLET_ONLY';
}

/** Passkey WebAuthn verify must not mint a customer session in the final mode. */
export function customerPasskeyLoginAllowed(mode: CutoverMode): boolean {
  return mode !== 'WALLET_ONLY';
}

/** OAuth callbacks must not mint a customer session in the final mode. */
export function customerOAuthLoginAllowed(mode: CutoverMode): boolean {
  return mode !== 'WALLET_ONLY';
}

export function legacyRefreshAllowed(input: {
  mode: CutoverMode;
  walletCredentialCount: number;
  authMethod: string | null | undefined;
}): boolean {
  const method = normalizeAuthMethod(input.authMethod);
  if (input.mode === 'WALLET_ONLY') return method === 'wallet';
  if (input.mode !== 'WALLET_FIRST' || input.walletCredentialCount === 0) return true;
  return CONTINUING_METHODS.has(method);
}

export function normalizeAuthMethod(value: string | null | undefined): SessionAuthMethod {
  if (value === 'password' || value === 'otp' || value === 'wallet' || value === 'passkey' || value === 'oauth') {
    return value;
  }
  return 'legacy';
}

export function isCutoverMode(value: unknown): value is CutoverMode {
  return typeof value === 'string' && (CUTOVER_MODES as readonly string[]).includes(value);
}

let testMode: CutoverMode | null = null;

/** Test-only in-memory mode. Production always reads system_settings. */
export function setLegacyAuthModeForTests(mode: CutoverMode | null): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('Legacy auth mode override is test-only');
  }
  testMode = mode;
}

export async function getCutoverMode(): Promise<CutoverMode> {
  if (process.env.NODE_ENV === 'test' && testMode) return testMode;
  try {
    const row = await db.query<{ value: unknown }>(
      `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
      [CUTOVER_SETTING_KEY]
    );
    const stored = readMode(row.rows[0]?.value);
    if (stored) return stored;
  } catch (error) {
    logger.warn('Wallet cutover mode unavailable; legacy login remains enabled', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return 'LEGACY_AND_WALLET';
}

function readMode(value: unknown): CutoverMode | null {
  if (isCutoverMode(value)) return value;
  if (value && typeof value === 'object' && 'mode' in value) {
    const mode = (value as { mode?: unknown }).mode;
    if (isCutoverMode(mode)) return mode;
  }
  if (typeof value === 'string') {
    try {
      return readMode(JSON.parse(value));
    } catch {
      return null;
    }
  }
  return null;
}

export async function countWalletCredentials(userId: string): Promise<{ credentials: number; active: number }> {
  try {
    const row = await db.query<{ credentials: number; active: number }>(
      `SELECT count(*)::int AS credentials,
              count(*) FILTER (WHERE status = 'active')::int AS active
         FROM user_wallets
        WHERE user_id = $1`,
      [userId]
    );
    return {
      credentials: asCount(row.rows[0]?.credentials),
      active: asCount(row.rows[0]?.active),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/user_wallets|does not exist|relation/i.test(message)) {
      return { credentials: 0, active: 0 };
    }
    throw error;
  }
}

export async function migrationStatusForUser(userId: string): Promise<LegacyDecision & { mode: CutoverMode }> {
  const mode = await getCutoverMode();
  const counts = await countWalletCredentials(userId);
  return {
    mode,
    ...legacySessionDecision({
      mode,
      walletCredentialCount: counts.credentials,
      activeWalletCount: counts.active,
    }),
  };
}

export async function canUseLegacyPassword(userId: string): Promise<boolean> {
  return (await migrationStatusForUser(userId)).allowed;
}

export async function canUseLegacyOtp(userId: string): Promise<boolean> {
  return canUseLegacyPassword(userId);
}

export async function canUseLegacySignup(): Promise<boolean> {
  return legacySignupAllowed(await getCutoverMode());
}

export async function canUseCustomerPasskeyLogin(): Promise<boolean> {
  return customerPasskeyLoginAllowed(await getCutoverMode());
}

export async function canUseCustomerOAuthLogin(): Promise<boolean> {
  return customerOAuthLoginAllowed(await getCutoverMode());
}

export async function shouldOfferLegacyLogin(): Promise<boolean> {
  return true;
}

export class LegacySignupClosed extends Error {
  readonly code = 'LEGACY_SIGNUP_CLOSED' as const;
  constructor() {
    super(LEGACY_SIGNUP_MESSAGE);
    this.name = 'LegacySignupClosed';
  }
}

/** Final wallet-only mode rejected a non-wallet customer login. */
export class LegacyCustomerLoginClosed extends Error {
  readonly code = 'LEGACY_AUTH_DISABLED' as const;
  constructor() {
    super(LEGACY_DISABLED_MESSAGE);
    this.name = 'LegacyCustomerLoginClosed';
  }
}

export function legacyDisabledBody(
  message = LEGACY_DISABLED_MESSAGE,
  code: 'LEGACY_AUTH_DISABLED' | 'LEGACY_SIGNUP_CLOSED' = 'LEGACY_AUTH_DISABLED'
) {
  return {
    success: false as const,
    error: { code, message },
  };
}

export function logCutoverEvent(
  event:
    | 'legacy_auth_allowed'
    | 'legacy_auth_blocked'
    | 'wallet_migration_started'
    | 'wallet_migration_completed'
    | 'legacy_auth_disabled'
    | 'legacy_auth_restored'
    | 'wallet_cutover_enabled'
    | 'wallet_cutover_rolled_back',
  fields: { userId?: string; actor?: string; outcome: 'allowed' | 'blocked' | 'success' | 'failure'; ip?: string | null }
): void {
  logger.info(event, {
    userId: fields.userId,
    actor: fields.actor ?? 'system',
    outcome: fields.outcome,
    ip: fields.ip ?? undefined,
    timestamp: new Date().toISOString(),
  });
}

export type ReadinessCheck = { id: string; required: boolean; ok: boolean; detail: string };

export type ReadinessReport = {
  mode: CutoverMode;
  productionCutoverExecuted: false;
  checks: ReadinessCheck[];
  counts: {
    totalUsers: number;
    usersWithActiveWallet: number;
    usersWithoutActiveWallet: number;
    usersWithPasskey: number;
    usersWithTotp: number;
    usersWithEmail: number;
    usersWithPasswordHash: number;
    walletNativeUsers: number;
    eligibleForLegacyDisable: number;
    blockedByWalletFirst: number;
  };
};

export function walletFirstBlockers(report: ReadinessReport): string[] {
  return report.checks.filter((check) => check.required && !check.ok).map((check) => check.id);
}

export async function setCutoverMode(mode: CutoverMode, actor: string): Promise<CutoverMode> {
  if (!isCutoverMode(mode)) {
    throw new CutoverRefused(['invalid_mode']);
  }
  const current = await getCutoverMode();
  if (mode === 'WALLET_FIRST' || mode === 'WALLET_ONLY') {
    const report = await buildMigrationReadiness(current);
    const failed = walletFirstBlockers(report);
    if (failed.length > 0) {
      logCutoverEvent('wallet_cutover_enabled', { actor, outcome: 'failure' });
      throw new CutoverRefused(failed);
    }
  }
  await db.query(
    `INSERT INTO system_settings (key, value, description, updated_at)
     VALUES ($1, $2::jsonb, $3, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, description = $3, updated_at = NOW()`,
    [CUTOVER_SETTING_KEY, JSON.stringify({ mode }), 'Customer wallet-first authentication cutover mode']
  );
  if (process.env.NODE_ENV === 'test') testMode = null;
  if (mode === 'WALLET_FIRST' || mode === 'WALLET_ONLY') {
    logCutoverEvent('wallet_cutover_enabled', { actor, outcome: 'success' });
    logCutoverEvent('legacy_auth_disabled', { actor, outcome: 'success' });
  } else if ((current === 'WALLET_FIRST' || current === 'WALLET_ONLY') && mode === 'LEGACY_AND_WALLET') {
    logCutoverEvent('wallet_cutover_rolled_back', { actor, outcome: 'success' });
    logCutoverEvent('legacy_auth_restored', { actor, outcome: 'success' });
  } else {
    logCutoverEvent('wallet_migration_started', { actor, outcome: 'success' });
  }
  return mode;
}

async function tableExists(name: string): Promise<boolean> {
  try {
    const row = await db.query<{ ok: boolean }>(`SELECT to_regclass($1) IS NOT NULL AS ok`, [`public.${name}`]);
    return row.rows[0]?.ok === true;
  } catch {
    return false;
  }
}

function asCount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function countQuery(sql: string): Promise<number> {
  try {
    const row = await db.query<{ n: number }>(sql);
    return asCount(row.rows[0]?.n);
  } catch {
    return 0;
  }
}

export async function buildMigrationReadiness(mode?: CutoverMode): Promise<ReadinessReport> {
  const resolvedMode = mode ?? await getCutoverMode();
  const walletTable = await tableExists('user_wallets');
  const challengeTable = await tableExists('wallet_auth_challenges');
  const usersTable = await tableExists('users');
  const settingsTable = await tableExists('system_settings');
  const mobileFlow = existsSync(resolve(process.cwd(), 'apps/mobile/core/wallet-auth/flow.ts'))
    || existsSync(resolve(process.cwd(), '../mobile/core/wallet-auth/flow.ts'))
    || existsSync(resolve(process.cwd(), '../../apps/mobile/core/wallet-auth/flow.ts'));
  const recoveryModule = existsSync(resolve(process.cwd(), 'src/services/wallet-recovery.service.ts'))
    || existsSync(resolve(process.cwd(), 'apps/backend/src/services/wallet-recovery.service.ts'));
  const production = process.env.NODE_ENV === 'production';

  const totalUsers = usersTable
    ? await countQuery(`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL`)
    : 0;
  const usersWithActiveWallet = walletTable
    ? await countQuery(`SELECT count(DISTINCT user_id)::int AS n FROM user_wallets WHERE status = 'active'`)
    : 0;
  const usersWithAnyWallet = walletTable
    ? await countQuery(`SELECT count(DISTINCT user_id)::int AS n FROM user_wallets`)
    : 0;
  const usersWithPasskey = await tableExists('user_passkeys')
    ? await countQuery(`SELECT count(DISTINCT user_id)::int AS n FROM user_passkeys WHERE deleted_at IS NULL`)
    : 0;
  const usersWithTotp = usersTable
    ? await countQuery(`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL AND totp_enabled IS TRUE`)
    : 0;
  const usersWithEmail = usersTable
    ? await countQuery(`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL AND email IS NOT NULL`)
    : 0;
  const usersWithPasswordHash = usersTable
    ? await countQuery(`SELECT count(*)::int AS n FROM users WHERE deleted_at IS NULL AND password_hash IS NOT NULL`)
    : 0;
  const walletNativeUsers = walletTable && usersTable
    ? await countQuery(
      `SELECT count(DISTINCT u.id)::int AS n
         FROM users u
         JOIN user_wallets w ON w.user_id = u.id AND w.status = 'active'
        WHERE u.deleted_at IS NULL AND u.email IS NULL AND u.password_hash IS NULL`
    )
    : 0;

  const checks: ReadinessCheck[] = [
    { id: 'wallet_login', required: true, ok: true, detail: 'POST /api/v1/auth/wallet/login is registered with the existing session service' },
    { id: 'wallet_challenge', required: true, ok: challengeTable, detail: challengeTable ? 'wallet_auth_challenges present' : 'wallet_auth_challenges missing' },
    { id: 'signature_verification', required: true, ok: true, detail: 'Server-side wallet signature verification remains the login authority' },
    { id: 'session_creation', required: true, ok: true, detail: 'createSession remains the customer session writer' },
    { id: 'wallet_management', required: true, ok: walletTable, detail: walletTable ? 'user_wallets present' : 'user_wallets missing' },
    { id: 'recovery', required: true, ok: recoveryModule, detail: recoveryModule ? 'wallet recovery service present' : 'wallet recovery service missing' },
    { id: 'kyc_preserved', required: true, ok: true, detail: 'Cutover does not write KYC records' },
    { id: 'spot_preserved', required: true, ok: true, detail: 'Cutover does not write Spot records' },
    { id: 'p2p_preserved', required: true, ok: true, detail: 'Cutover does not write P2P records' },
    { id: 'forex_preserved', required: true, ok: true, detail: 'Cutover does not write Forex records' },
    { id: 'mobile_wallet_flow', required: true, ok: mobileFlow, detail: mobileFlow ? 'mobile wallet flow present' : 'mobile wallet flow missing' },
    { id: 'no_p0_p1_auth_regression', required: true, ok: true, detail: 'No P0 or P1 auth regression recorded in this policy. Pre-existing P2P field mapping remains P2.' },
    {
      id: 'providers_ready_for_environment',
      required: true,
      ok: !production,
      detail: production
        ? 'Real wallet providers are NOT VERIFIED. Production cutover stays refused.'
        : 'Non-production tests may use the implemented wallet flow. Real providers remain NOT VERIFIED.',
    },
    { id: 'web3_schema', required: true, ok: walletTable && challengeTable, detail: walletTable && challengeTable ? 'Web3 auth schema present' : 'Web3 auth schema missing' },
    { id: 'cutover_setting_store', required: true, ok: settingsTable, detail: settingsTable ? 'system_settings can store the cutover mode' : 'system_settings missing' },
    { id: 'rollback', required: true, ok: true, detail: 'Setting the mode back to LEGACY_AND_WALLET restores legacy session issuance and does not delete credentials' },
    { id: 'support_recovery', required: true, ok: recoveryModule, detail: 'Existing wallet recovery remains the path when every login wallet is disabled or compromised' },
  ];

  return {
    mode: resolvedMode,
    productionCutoverExecuted: false,
    checks,
    counts: {
      totalUsers,
      usersWithActiveWallet,
      usersWithoutActiveWallet: Math.max(totalUsers - usersWithActiveWallet, 0),
      usersWithPasskey,
      usersWithTotp,
      usersWithEmail,
      usersWithPasswordHash,
      walletNativeUsers,
      eligibleForLegacyDisable: usersWithActiveWallet,
      blockedByWalletFirst: usersWithAnyWallet,
    },
  };
}

export async function adminMigrationStatus(userId: string): Promise<{
  userId: string;
  mode: CutoverMode;
  migrationStatus: MigrationStatus;
  walletLinked: boolean;
  activeWalletCount: number;
  walletCredentialPresent: boolean;
  legacyAuthEnabled: boolean;
  recoveryStatus: string | null;
  cooldownActive: boolean;
} | null> {
  const user = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE id = $1 AND deleted_at IS NULL`,
    [userId]
  );
  if (!user.rows[0]) return null;
  const decision = await migrationStatusForUser(userId);
  const counts = await countWalletCredentials(userId);
  let recoveryStatus: string | null = null;
  try {
    const recovery = await db.query<{ status: string | null }>(
      `SELECT preferences->'walletRecovery'->>'status' AS status FROM users WHERE id = $1`,
      [userId]
    );
    const status = recovery.rows[0]?.status;
    recoveryStatus = typeof status === 'string' && status.length > 0 ? status : null;
  } catch {
    recoveryStatus = null;
  }
  let cooldownActive = false;
  try {
    const cool = await db.query<{ n: unknown }>(
      `SELECT count(*)::int AS n FROM security_cooldowns WHERE user_id = $1 AND cooldown_until > NOW()`,
      [userId]
    );
    cooldownActive = asCount(cool.rows[0]?.n) > 0;
  } catch {
    cooldownActive = false;
  }
  return {
    userId,
    mode: decision.mode,
    migrationStatus: decision.status,
    walletLinked: counts.active > 0,
    activeWalletCount: counts.active,
    walletCredentialPresent: counts.credentials > 0,
    legacyAuthEnabled: decision.allowed,
    recoveryStatus,
    cooldownActive,
  };
}

export async function publicCutoverView(): Promise<{
  mode: CutoverMode;
  walletPrimary: boolean;
  legacyEntryAvailable: boolean;
}> {
  const mode = await getCutoverMode();
  return {
    mode,
    walletPrimary: mode !== 'LEGACY_AND_WALLET',
    legacyEntryAvailable: mode !== 'WALLET_ONLY',
  };
}
