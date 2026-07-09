/**
 * Tier-1 Compliance Policy Engine — single runtime source in system_settings.
 * Extends existing dynamic configuration (no parallel config system).
 */
import { db } from '../lib/database.js';
import { redis } from '../lib/redis.js';
import { logger } from '../lib/logger.js';
import {
  assertKycAllowed,
  KycPendingError,
  KycRequiredError,
  type KycAction,
} from './kyc-enforcement.service.js';
import { config } from '../config/index.js';
import { Decimal } from '../lib/decimal.js';
import {
  evaluateTransactionForAlerts,
  recordTransaction,
  type RecordTransactionParams,
  type TxnType,
} from './aml-transaction-monitor.service.js';
import {
  COMPLIANCE_OPERATIONS,
  COMPLIANCE_POLICY_DB_KEY,
  type AmlPolicyMode,
  type ComplianceOperation,
  type CompliancePolicyDocument,
  type CompliancePolicyPatch,
  type CompliancePresetId,
  type KycPolicyMode,
} from '../types/compliance-policy.js';

const CACHE_KEY = 'compliance:policy:v1';
const CACHE_TTL_SEC = 30;

export class ComplianceBlockedError extends Error {
  readonly code: 'KYC_REQUIRED' | 'KYC_PENDING' | 'AML_BLOCKED' | 'AML_REVIEW_REQUIRED';

  constructor(code: ComplianceBlockedError['code'], message: string) {
    super(message);
    this.name = 'ComplianceBlockedError';
    this.code = code;
  }
}

function defaultKyc(mode: KycPolicyMode = 'disabled'): Record<ComplianceOperation, KycPolicyMode> {
  return Object.fromEntries(COMPLIANCE_OPERATIONS.map((op) => [op, mode])) as Record<
    ComplianceOperation,
    KycPolicyMode
  >;
}

function defaultAml(mode: AmlPolicyMode = 'disabled'): Record<ComplianceOperation, AmlPolicyMode> {
  return Object.fromEntries(COMPLIANCE_OPERATIONS.map((op) => [op, mode])) as Record<
    ComplianceOperation,
    AmlPolicyMode
  >;
}

export function buildPresetPolicy(preset: CompliancePresetId): CompliancePolicyDocument {
  const now = new Date().toISOString();
  if (preset === 'production') {
    const kyc = defaultKyc('required');
    kyc.login = 'optional';
    kyc.signup = 'required';
    kyc.internal_transfer = 'optional';
    kyc.funding_transfer = 'optional';
    kyc.trading_transfer = 'optional';
    const aml = defaultAml('warn_only');
    aml.withdrawal = 'strict_blocking';
    aml.deposit = 'manual_review';
    aml.p2p = 'manual_review';
    aml.spot_trading = 'warn_only';
    return {
      version: 1,
      activePreset: preset,
      environmentLabel: 'Production',
      kyc,
      aml,
      updatedAt: now,
      updatedBy: null,
    };
  }
  if (preset === 'soft_launch') {
    const kyc = defaultKyc('optional');
    kyc.withdrawal = 'required';
    kyc.p2p = 'optional';
    const aml = defaultAml('warn_only');
    aml.withdrawal = 'manual_review';
    return {
      version: 1,
      activePreset: preset,
      environmentLabel: 'Soft Launch',
      kyc,
      aml,
      updatedAt: now,
      updatedBy: null,
    };
  }
  if (preset === 'internal_qa') {
    return {
      version: 1,
      activePreset: preset,
      environmentLabel: 'Internal QA',
      kyc: defaultKyc('disabled'),
      aml: defaultAml('disabled'),
      updatedAt: now,
      updatedBy: null,
    };
  }
  // closed_beta — default for beta testers
  const kyc = defaultKyc('disabled');
  const aml = defaultAml('disabled');
  return {
    version: 1,
    activePreset: 'closed_beta',
    environmentLabel: 'Closed Beta',
    kyc,
    aml,
    updatedAt: now,
    updatedBy: null,
  };
}

function parsePolicyJson(raw: unknown): CompliancePolicyDocument | null {
  if (!raw) return null;
  try {
    const obj = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!obj || obj.version !== 1 || !obj.kyc || !obj.aml) return null;
    return obj as CompliancePolicyDocument;
  } catch {
    return null;
  }
}

async function loadPolicyFromDb(): Promise<CompliancePolicyDocument> {
  try {
    const row = await db.query<{ value: unknown }>(
      `SELECT value FROM system_settings WHERE key = $1 LIMIT 1`,
      [COMPLIANCE_POLICY_DB_KEY]
    );
    const parsed = parsePolicyJson(row.rows[0]?.value);
    if (parsed) return parsed;
  } catch (e) {
    logger.warn('compliance policy load failed, using legacy keys', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
  return migrateFromLegacySettings();
}

async function migrateFromLegacySettings(): Promise<CompliancePolicyDocument> {
  const policy = buildPresetPolicy('closed_beta');
  try {
    const rows = await db.query<{ key: string; value: unknown }>(
      `SELECT key, value FROM system_settings WHERE key IN ('kyc_required_for_withdrawal', 'kyc_required_for_trading')`
    );
    for (const r of rows.rows) {
      const on =
        r.value === true ||
        r.value === 'true' ||
        (typeof r.value === 'string' && r.value.toLowerCase() === 'true');
      if (r.key === 'kyc_required_for_withdrawal' && on) policy.kyc.withdrawal = 'required';
      if (r.key === 'kyc_required_for_trading' && on) policy.kyc.spot_trading = 'required';
    }
  } catch {
    /* ignore */
  }
  return policy;
}

export async function getCompliancePolicy(): Promise<CompliancePolicyDocument> {
  try {
    const cached = await redis.getJson<CompliancePolicyDocument>(CACHE_KEY);
    if (cached?.version === 1) return cached;
  } catch {
    /* fall through */
  }
  const policy = await loadPolicyFromDb();
  try {
    await redis.setJson(CACHE_KEY, policy, CACHE_TTL_SEC);
  } catch {
    /* ignore */
  }
  return policy;
}

export async function invalidateCompliancePolicyCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function mergePolicy(
  current: CompliancePolicyDocument,
  patch: CompliancePolicyPatch,
  updatedBy: string | null
): CompliancePolicyDocument {
  const next: CompliancePolicyDocument = {
    ...current,
    activePreset: patch.activePreset ?? current.activePreset,
    environmentLabel: patch.environmentLabel ?? current.environmentLabel,
    kyc: { ...current.kyc, ...(patch.kyc ?? {}) },
    aml: { ...current.aml, ...(patch.aml ?? {}) },
    updatedAt: new Date().toISOString(),
    updatedBy,
  };
  return next;
}

async function syncLegacyKycKeys(policy: CompliancePolicyDocument): Promise<void> {
  const withdrawalRequired = policy.kyc.withdrawal === 'required';
  const tradingRequired = policy.kyc.spot_trading === 'required';
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    ['kyc_required_for_withdrawal', withdrawalRequired ? 'true' : 'false']
  );
  await db.query(
    `INSERT INTO system_settings (key, value, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = NOW()`,
    ['kyc_required_for_trading', tradingRequired ? 'true' : 'false']
  );
}

export async function saveCompliancePolicy(
  patch: CompliancePolicyPatch,
  updatedBy: string | null
): Promise<CompliancePolicyDocument> {
  const current = await loadPolicyFromDb();
  const next = mergePolicy(current, patch, updatedBy);
  await db.query(
    `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, NOW(), NULL)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = NULL`,
    [
      COMPLIANCE_POLICY_DB_KEY,
      JSON.stringify(next),
      'Tier-1 runtime compliance policy (KYC + AML per operation)',
    ]
  );
  await syncLegacyKycKeys(next);
  await invalidateCompliancePolicyCache();
  return next;
}

export async function applyCompliancePreset(
  preset: CompliancePresetId,
  updatedBy: string | null
): Promise<CompliancePolicyDocument> {
  const built = buildPresetPolicy(preset);
  built.updatedBy = updatedBy;
  await db.query(
    `INSERT INTO system_settings (key, value, description, updated_at, updated_by)
     VALUES ($1, $2::jsonb, $3, NOW(), NULL)
     ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW(), updated_by = NULL`,
    [
      COMPLIANCE_POLICY_DB_KEY,
      JSON.stringify(built),
      'Tier-1 runtime compliance policy (KYC + AML per operation)',
    ]
  );
  await syncLegacyKycKeys(built);
  await invalidateCompliancePolicyCache();
  return built;
}

function kycActionForOperation(op: ComplianceOperation): KycAction | null {
  const map: Partial<Record<ComplianceOperation, KycAction>> = {
    withdrawal: 'withdrawal',
    p2p: 'p2p_sell',
    spot_trading: 'spot_trade',
    deposit: 'fiat_deposit',
    convert: 'spot_trade',
    api_trading: 'spot_trade',
  };
  return map[op] ?? null;
}

function amlTxnTypeForOperation(op: ComplianceOperation): TxnType | null {
  const map: Partial<Record<ComplianceOperation, TxnType>> = {
    deposit: 'deposit',
    withdrawal: 'withdrawal',
    spot_trading: 'trade',
    p2p: 'p2p',
    internal_transfer: 'internal_transfer',
    funding_transfer: 'internal_transfer',
    trading_transfer: 'internal_transfer',
    convert: 'trade',
    api_trading: 'trade',
  };
  return map[op] ?? null;
}

async function amlRiskTriggered(params: RecordTransactionParams): Promise<boolean> {
  const cfg = config.aml;
  const amountDec =
    params.amount != null ? new Decimal(typeof params.amount === 'string' ? params.amount : params.amount) : null;
  const fiatDec =
    params.fiatAmount != null
      ? new Decimal(typeof params.fiatAmount === 'string' ? params.fiatAmount : params.fiatAmount)
      : null;
  const country = params.countryCode?.trim().toUpperCase() ?? null;

  const isInr = !params.fiatCurrency || params.fiatCurrency.toUpperCase() === 'INR';
  if (isInr && fiatDec != null && fiatDec.gte(cfg.largeFiatInrThreshold)) return true;

  if (params.txnType === 'withdrawal' && amountDec != null && amountDec.gte(cfg.largeCryptoWithdrawalThreshold)) {
    return true;
  }

  if (country && cfg.highRiskCountries.length > 0 && cfg.highRiskCountries.includes(country)) return true;

  if (params.txnType === 'withdrawal') {
    try {
      const countResult = await db.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM aml_transaction_logs
         WHERE user_id = $1 AND txn_type = 'withdrawal' AND created_at > NOW() - ($2 || ' hours')::interval`,
        [params.userId, cfg.velocityWindowHours]
      );
      const count = parseInt(countResult.rows[0]?.count ?? '0', 10);
      if (count >= cfg.velocityWithdrawalCount) return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export async function enforceCompliancePolicy(params: {
  userId: string;
  operation: ComplianceOperation;
  aml?: Omit<RecordTransactionParams, 'userId' | 'txnType'>;
}): Promise<void> {
  const policy = await getCompliancePolicy();
  const kycMode = policy.kyc[params.operation] ?? 'disabled';

  if (kycMode === 'required') {
    const action = kycActionForOperation(params.operation);
    if (action) {
      try {
        await assertKycAllowed({ userId: params.userId, action });
      } catch (err) {
        if (err instanceof KycPendingError) {
          throw new ComplianceBlockedError('KYC_PENDING', err.message);
        }
        if (err instanceof KycRequiredError) {
          throw new ComplianceBlockedError('KYC_REQUIRED', err.message);
        }
        throw err;
      }
    }
  }

  const amlMode = policy.aml[params.operation] ?? 'disabled';
  if (amlMode === 'disabled' || !params.aml) return;

  const txnType = amlTxnTypeForOperation(params.operation);
  if (!txnType) return;

  const recordParams: RecordTransactionParams = { userId: params.userId, txnType, ...params.aml };

  if (amlMode === 'warn_only') {
    void recordTransaction(recordParams).then((id) =>
      evaluateTransactionForAlerts({ ...recordParams, transactionLogId: id })
    );
    return;
  }

  const wouldBlock = await amlRiskTriggered(recordParams);
  if (!wouldBlock) {
    void recordTransaction(recordParams).then((id) =>
      evaluateTransactionForAlerts({ ...recordParams, transactionLogId: id })
    );
    return;
  }

  if (amlMode === 'manual_review') {
    throw new ComplianceBlockedError(
      'AML_REVIEW_REQUIRED',
      'This transaction requires manual compliance review before it can proceed.'
    );
  }

  if (amlMode === 'strict_blocking') {
    throw new ComplianceBlockedError(
      'AML_BLOCKED',
      'This transaction was blocked by AML policy. Contact support if you believe this is an error.'
    );
  }
}

export function publicComplianceSnapshot(policy: CompliancePolicyDocument) {
  return {
    environmentLabel: policy.environmentLabel,
    activePreset: policy.activePreset,
    kyc: policy.kyc,
    aml: policy.aml,
    updatedAt: policy.updatedAt,
  };
}
