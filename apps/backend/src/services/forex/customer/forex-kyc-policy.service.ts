/**
 * Admin-controllable Forex KYC policy.
 *
 * Stored only in system_settings.forex_kyc_required (JSON boolean).
 * Absent or unreadable → required (today's live-application gate).
 * Explicit false → Forex KYC is not mandatory.
 *
 * Does not read or write crypto compliance keys
 * (compliance_policy_v1, kyc_required_for_withdrawal, kyc_required_for_trading).
 */
import { db } from '../../../lib/database.js';
import { getPlatformKycSnapshot, type PlatformKycSnapshot } from './platform-kyc.js';

export const FOREX_KYC_REQUIRED_SETTING_KEY = 'forex_kyc_required';

export const FOREX_KYC_REQUIRED_MESSAGE =
  'Identity verification must be approved before applying for a live Forex account.';

export type ForexKycPolicy = {
  required: boolean;
  source: 'default' | 'system_settings';
};

/** null means the stored value is absent or not a boolean — caller keeps the default (required). */
export function parseForexKycRequiredValue(value: unknown): boolean | null {
  if (value === true || value === false) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    try {
      return parseForexKycRequiredValue(JSON.parse(value));
    } catch {
      return null;
    }
  }
  if (value && typeof value === 'object' && 'required' in value) {
    return parseForexKycRequiredValue((value as { required: unknown }).required);
  }
  return null;
}

export function evaluateForexKycGate(
  required: boolean,
  verified: boolean,
): { ok: true } | { ok: false; code: 'KYC_REQUIRED'; message: string } {
  if (!required || verified) return { ok: true };
  return { ok: false, code: 'KYC_REQUIRED', message: FOREX_KYC_REQUIRED_MESSAGE };
}

let testRequiredOverride: boolean | null = null;
let testSnapshotReader: ((userId: string) => Promise<Pick<PlatformKycSnapshot, 'verified'>>) | null = null;

function testsAllowed(): boolean {
  return process.env.NODE_ENV !== 'production';
}

/** Test-only. Ignored when NODE_ENV=production. Pass null to resume database reads. */
export function setForexKycRequiredForTests(value: boolean | null): boolean {
  if (!testsAllowed()) return false;
  testRequiredOverride = value;
  return true;
}

/** Test-only snapshot stand-in. Ignored when NODE_ENV=production. */
export function setForexKycSnapshotReaderForTests(
  reader: ((userId: string) => Promise<Pick<PlatformKycSnapshot, 'verified'>>) | null,
): boolean {
  if (!testsAllowed()) return false;
  testSnapshotReader = reader;
  return true;
}

export async function getForexKycPolicy(): Promise<ForexKycPolicy> {
  if (testsAllowed() && testRequiredOverride !== null) {
    return { required: testRequiredOverride, source: 'system_settings' };
  }
  try {
    const row = await db.query<{ value: unknown }>(
      `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
      [FOREX_KYC_REQUIRED_SETTING_KEY],
    );
    const parsed = parseForexKycRequiredValue(row.rows[0]?.value);
    if (parsed === null) return { required: true, source: 'default' };
    return { required: parsed, source: 'system_settings' };
  } catch {
    return { required: true, source: 'default' };
  }
}

export async function isForexKycRequired(): Promise<boolean> {
  return (await getForexKycPolicy()).required;
}

export async function setForexKycRequired(required: boolean): Promise<ForexKycPolicy> {
  if (testsAllowed() && testRequiredOverride !== null) {
    testRequiredOverride = required;
    return { required, source: 'system_settings' };
  }
  await db.query(
    `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, NOW(), NULL)
     ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           description = EXCLUDED.description,
           updated_at = NOW(),
           updated_by = NULL`,
    [
      FOREX_KYC_REQUIRED_SETTING_KEY,
      JSON.stringify(required),
      'Forex live-account KYC gate. true enforces approved platform KYC; false makes Forex KYC optional. Does not change crypto KYC.',
    ],
  );
  return { required, source: 'system_settings' };
}

export async function assertForexLiveKyc(
  userId: string,
): Promise<{ ok: true; required: boolean } | { ok: false; code: 'KYC_REQUIRED'; message: string }> {
  const policy = await getForexKycPolicy();
  if (!policy.required) return { ok: true, required: false };
  const kyc =
    testsAllowed() && testSnapshotReader
      ? await testSnapshotReader(userId)
      : await getPlatformKycSnapshot(userId);
  const gate = evaluateForexKycGate(true, kyc.verified);
  if (!gate.ok) return gate;
  return { ok: true, required: true };
}
