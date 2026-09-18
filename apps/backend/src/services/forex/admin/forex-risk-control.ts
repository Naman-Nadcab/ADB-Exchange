/**
 * Forex risk control plane — read-only effective state from existing policy/controls (no parallel engine).
 */
import { buildForexAdminControlsSnapshot } from './controls.js';
import { buildForexAdminPolicySnapshot } from './policy.js';

export type ForexRiskControlField = {
  key: string;
  label: string;
  current_value: unknown;
  source: string;
  engine_applied: boolean;
  last_changed: 'UNKNOWN' | 'RUNTIME_OVERRIDE';
};

export type ForexRiskControlSnapshot = {
  posture: {
    real_forex: boolean;
    kill_switch: boolean;
    economic_ready: boolean;
  };
  fields: ForexRiskControlField[];
  note: string;
};

export function buildForexAdminRiskControlSnapshot(): ForexRiskControlSnapshot {
  const controls = buildForexAdminControlsSnapshot();
  const policy = buildForexAdminPolicySnapshot();

  const fields: ForexRiskControlField[] = [
    {
      key: 'kill_switch',
      label: 'Global kill switch',
      current_value: controls.effective.killSwitch,
      source: 'forex_runtime_controls',
      engine_applied: true,
      last_changed: 'RUNTIME_OVERRIDE',
    },
    {
      key: 'global_max_leverage',
      label: 'Global max leverage',
      current_value: policy.leverage.effective.globalMax,
      source: 'forex_policy_snapshot',
      engine_applied: true,
      last_changed: 'RUNTIME_OVERRIDE',
    },
    {
      key: 'stop_out_level',
      label: 'Stop-out level',
      current_value: policy.margin.effective.stopOutLevel,
      source: 'forex_policy_snapshot',
      engine_applied: true,
      last_changed: 'RUNTIME_OVERRIDE',
    },
    {
      key: 'account_group_leverage_default',
      label: 'Account group leverage (DB profile)',
      current_value: 'See account groups',
      source: 'forex_account_groups.leverage_default → risk engine',
      engine_applied: true,
      last_changed: 'UNKNOWN',
    },
    {
      key: 'account_group_commission_profile',
      label: 'Account group commission profile',
      current_value: 'JSON → setForexAccountCommission on hydrate/assign',
      source: 'forex_account_groups.commission_profile',
      engine_applied: true,
      last_changed: 'UNKNOWN',
    },
    {
      key: 'account_group_swap_profile',
      label: 'Account group swap profile',
      current_value: 'JSON → setForexAccountSwap on hydrate/assign',
      source: 'forex_account_groups.swap_profile',
      engine_applied: true,
      last_changed: 'UNKNOWN',
    },
    {
      key: 'account_group_spread_profile',
      label: 'Account group spread / maxSpread',
      current_value: 'JSON → setForexAccountLimits.maxSpread',
      source: 'forex_account_groups.spread_profile',
      engine_applied: true,
      last_changed: 'UNKNOWN',
    },
    {
      key: 'account_leverage_override',
      label: 'Per-account leverage override',
      current_value: 'See account record',
      source: 'forex_accounts.leverage_override → risk engine maxLeverage',
      engine_applied: true,
      last_changed: 'UNKNOWN',
    },
  ];

  return {
    posture: {
      real_forex:
        process.env.REAL_FOREX === '1' || (process.env.REAL_FOREX ?? '').toLowerCase() === 'true',
      kill_switch: controls.effective.killSwitch,
      economic_ready: controls.readiness.economicReady,
    },
    fields,
    note: 'engine_applied=false means persisted/admin-only until runtime reads DB field · REAL_FOREX remains gated',
  };
}
