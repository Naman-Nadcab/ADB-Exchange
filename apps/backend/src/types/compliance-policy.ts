/** Runtime compliance policy — stored in system_settings.compliance_policy_v1 (JSON). */

export type KycPolicyMode = 'required' | 'optional' | 'disabled';

export type AmlPolicyMode = 'disabled' | 'warn_only' | 'manual_review' | 'strict_blocking';

export type ComplianceOperation =
  | 'signup'
  | 'login'
  | 'spot_trading'
  | 'p2p'
  | 'deposit'
  | 'withdrawal'
  | 'funding_transfer'
  | 'trading_transfer'
  | 'internal_transfer'
  | 'api_trading'
  | 'launchpad'
  | 'earn'
  | 'staking'
  | 'convert'
  | 'margin'
  | 'futures'
  | 'referral_withdraw'
  | 'admin_actions';

export type CompliancePresetId = 'internal_qa' | 'closed_beta' | 'soft_launch' | 'production';

export const COMPLIANCE_OPERATIONS: ComplianceOperation[] = [
  'signup',
  'login',
  'spot_trading',
  'p2p',
  'deposit',
  'withdrawal',
  'funding_transfer',
  'trading_transfer',
  'internal_transfer',
  'api_trading',
  'launchpad',
  'earn',
  'staking',
  'convert',
  'margin',
  'futures',
  'referral_withdraw',
  'admin_actions',
];

export const COMPLIANCE_POLICY_DB_KEY = 'compliance_policy_v1';

export interface CompliancePolicyDocument {
  version: 1;
  activePreset: CompliancePresetId | 'custom';
  environmentLabel: string;
  kyc: Record<ComplianceOperation, KycPolicyMode>;
  aml: Record<ComplianceOperation, AmlPolicyMode>;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CompliancePolicyPatch {
  activePreset?: CompliancePresetId | 'custom';
  environmentLabel?: string;
  kyc?: Partial<Record<ComplianceOperation, KycPolicyMode>>;
  aml?: Partial<Record<ComplianceOperation, AmlPolicyMode>>;
}
