/**
 * One factor policy for wallet-first accounts.
 * Email and phone are contact channels. They are not wallet ownership.
 * Wallet signature is not KYC.
 */

/* eslint-disable no-unused-vars */
export type PolicyQuery = (
  sql: string,
  params?: unknown[]
) => Promise<{ rows: Array<Record<string, unknown>> }>;
/* eslint-enable no-unused-vars */

export type FactorSnapshot = {
  activeWalletCount: number;
  passkeyCount: number;
  totpEnabled: boolean;
  hasPassword: boolean;
  hasEmail: boolean;
  hasPhone: boolean;
};

function countFrom(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length > 0) return +value;
  return 0;
}

function flag(value: unknown): boolean {
  return value === true;
}

export async function loadFactorSnapshot(query: PolicyQuery, userId: string): Promise<FactorSnapshot> {
  const user = await query(
    `SELECT
       (password_hash IS NOT NULL) AS has_password,
       (email IS NOT NULL AND btrim(email) <> '') AS has_email,
       (phone IS NOT NULL AND btrim(phone) <> '') AS has_phone,
       (
         COALESCE(totp_enabled, FALSE)
         OR COALESCE(two_fa_enabled, FALSE)
         OR COALESCE(two_factor_enabled, FALSE)
       ) AS totp_enabled
     FROM users
     WHERE id = $1::uuid AND deleted_at IS NULL`,
    [userId]
  );
  const row = user.rows[0];
  const wallets = await query(
    `SELECT count(*)::int AS n FROM user_wallets WHERE user_id = $1::uuid AND status = 'active'`,
    [userId]
  );
  const passkeys = await query(
    `SELECT count(*)::int AS n FROM user_passkeys WHERE user_id = $1::uuid AND deleted_at IS NULL`,
    [userId]
  );
  return {
    activeWalletCount: countFrom(wallets.rows[0]?.n),
    passkeyCount: countFrom(passkeys.rows[0]?.n),
    totpEnabled: flag(row?.totp_enabled),
    hasPassword: flag(row?.has_password),
    hasEmail: flag(row?.has_email),
    hasPhone: flag(row?.has_phone),
  };
}

/** Password, another wallet, passkey, or TOTP. Email and phone are excluded. */
export function hasStrongFactor(snapshot: FactorSnapshot, extraActiveWallets = snapshot.activeWalletCount): boolean {
  return extraActiveWallets > 0 || snapshot.passkeyCount > 0 || snapshot.totpEnabled || snapshot.hasPassword;
}

export function canUnlinkLastWallet(snapshot: FactorSnapshot): boolean {
  return snapshot.passkeyCount > 0 || snapshot.totpEnabled || snapshot.hasPassword;
}

export function canRemoveLastPasskey(snapshot: FactorSnapshot): boolean {
  return snapshot.activeWalletCount > 0 || snapshot.totpEnabled || snapshot.hasPassword;
}

export function canDisableTotp(snapshot: FactorSnapshot): boolean {
  return snapshot.activeWalletCount > 0 || snapshot.passkeyCount > 0 || snapshot.hasPassword;
}

/** Email OTP is never authority to attach or replace a login wallet. */
export function emailOtpCanAttachWallet(): false {
  return false;
}
