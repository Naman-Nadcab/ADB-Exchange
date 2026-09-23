/**
 * Read platform KYC state for Forex customer lifecycle (no duplicate KYC engine).
 */
import { db } from '../../../lib/database.js';

export type PlatformKycSnapshot = {
  verified: boolean;
  status: string;
  level: number;
};

export async function getPlatformKycSnapshot(userId: string): Promise<PlatformKycSnapshot> {
  const res = await db.query<{ status: string; kyc_level: number | null }>(
    `SELECT status, kyc_level FROM kyc_applications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) {
    return { verified: false, status: 'not_submitted', level: 0 };
  }
  const verified = row.status === 'approved';
  return {
    verified,
    status: String(row.status),
    level: row.kyc_level ?? (verified ? 1 : 0),
  };
}
