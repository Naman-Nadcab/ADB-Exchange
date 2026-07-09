import { adminFetch } from './api';

export type KycPolicyMode = 'required' | 'optional' | 'disabled';
export type AmlPolicyMode = 'disabled' | 'warn_only' | 'manual_review' | 'strict_blocking';
export type CompliancePresetId = 'internal_qa' | 'closed_beta' | 'soft_launch' | 'production';

export type ComplianceOperation =
  | 'signup' | 'login' | 'spot_trading' | 'p2p' | 'deposit' | 'withdrawal'
  | 'funding_transfer' | 'trading_transfer' | 'internal_transfer' | 'api_trading'
  | 'launchpad' | 'earn' | 'staking' | 'convert' | 'margin' | 'futures'
  | 'referral_withdraw' | 'admin_actions';

export interface CompliancePolicyDocument {
  version: 1;
  activePreset: CompliancePresetId | 'custom';
  environmentLabel: string;
  kyc: Record<ComplianceOperation, KycPolicyMode>;
  aml: Record<ComplianceOperation, AmlPolicyMode>;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const COMPLIANCE_OPERATIONS: ComplianceOperation[] = [
  'signup', 'login', 'spot_trading', 'p2p', 'deposit', 'withdrawal',
  'funding_transfer', 'trading_transfer', 'internal_transfer', 'api_trading',
  'launchpad', 'earn', 'staking', 'convert', 'margin', 'futures',
  'referral_withdraw', 'admin_actions',
];

export function getCompliancePolicy(token: string | null) {
  return adminFetch<CompliancePolicyDocument>('/compliance/policy', { token });
}

export function patchCompliancePolicy(
  token: string | null,
  body: {
    reason: string;
    activePreset?: CompliancePresetId | 'custom';
    environmentLabel?: string;
    kyc?: Partial<Record<ComplianceOperation, KycPolicyMode>>;
    aml?: Partial<Record<ComplianceOperation, AmlPolicyMode>>;
    twofa_code?: string;
  }
) {
  return adminFetch<CompliancePolicyDocument>('/compliance/policy', { method: 'PATCH', token, body });
}

export function applyCompliancePreset(
  token: string | null,
  preset: CompliancePresetId,
  reason: string,
  twofa_code?: string
) {
  return adminFetch<CompliancePolicyDocument>('/compliance/policy/apply-preset', {
    method: 'POST',
    token,
    body: { preset, reason, twofa_code },
  });
}
