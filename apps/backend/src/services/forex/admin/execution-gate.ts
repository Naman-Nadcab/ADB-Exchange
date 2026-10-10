/**
 * REAL_FOREX certification gate (F5). Admin may record "arm requested" intent only;
 * effective real-money execution stays OFF until a future certified release enables it.
 */
import { forexReadinessSnapshot } from '../durability/ready.js';
import { effectiveForexRuntimeFlags } from './runtime-controls.js';

export type ForexRealForexChecklistItemId =
  | 'mock_lp_only'
  | 'execution_mode_mock'
  | 'effective_real_forex_off'
  | 'kill_switch_off'
  | 'economic_ready'
  | 'env_real_forex_allowed';

export type ForexRealForexChecklistItem = {
  id: ForexRealForexChecklistItemId;
  label: string;
  pass: boolean;
  detail: string;
};

export type ForexRealForexGateState = {
  /** True only when the LP plug is armed (base URL, API key, and FOREX_REAL_FOREX_ALLOWED). */
  effectiveRealForex: boolean;
  armRequested: boolean;
  envRealForexAllowed: boolean;
  releaseBlocked: boolean;
  releaseBlockReason: string;
  checklistComplete: boolean;
  checklist: ForexRealForexChecklistItem[];
};

let realForexArmRequested = false;

function envRealForexAllowed(): boolean {
  const raw = process.env.FOREX_REAL_FOREX_ALLOWED?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

export function forexRealForexArmRequested(): boolean {
  return realForexArmRequested;
}

export function setForexRealForexArmRequested(value: boolean): { previous: boolean; next: boolean } {
  const previous = realForexArmRequested;
  realForexArmRequested = value;
  return { previous, next: value };
}

export function buildForexRealForexChecklist(args: {
  mockProvidersOnly: boolean;
  marketDataRunning: boolean;
}): ForexRealForexChecklistItem[] {
  const flags = effectiveForexRuntimeFlags();
  const readiness = forexReadinessSnapshot();
  const envAllowed = envRealForexAllowed();

  return [
    {
      id: 'mock_lp_only',
      label: 'Liquidity providers are MOCK-only',
      pass: args.mockProvidersOnly,
      detail: args.mockProvidersOnly ? 'All routing rules reference MOCK LPs.' : 'Non-MOCK provider detected in routing table.',
    },
    {
      id: 'execution_mode_mock',
      label: 'Execution mode is MOCK',
      pass: flags.executionMode === 'MOCK',
      detail: `executionMode=${flags.executionMode}`,
    },
    {
      id: 'effective_real_forex_off',
      label: 'Effective REAL_FOREX is OFF',
      pass: flags.realForex === false,
      detail: 'Runtime gate keeps realForex=false.',
    },
    {
      id: 'kill_switch_off',
      label: 'Forex kill switch is OFF',
      pass: !flags.killSwitch,
      detail: flags.killSwitch ? 'Kill switch is ON — arming blocked.' : 'Kill switch OFF.',
    },
    {
      id: 'economic_ready',
      label: 'Economic readiness (ledger / durability)',
      pass: readiness.economicReady,
      detail: readiness.reason ?? (readiness.economicReady ? 'economicReady=true' : 'economicReady=false'),
    },
    {
      id: 'env_real_forex_allowed',
      label: 'FOREX_REAL_FOREX_ALLOWED env (must be OFF for F5 arm)',
      pass: !envAllowed,
      detail: envAllowed
        ? 'Env allows real forex — F5 admin arm stays blocked until LP program ships.'
        : 'FOREX_REAL_FOREX_ALLOWED not set (safe default).',
    },
  ];
}

export function buildForexRealForexGateState(args: {
  mockProvidersOnly: boolean;
  marketDataRunning: boolean;
}): ForexRealForexGateState {
  const checklist = buildForexRealForexChecklist(args);
  const checklistComplete = checklist.every((c) => c.pass);

  const flags = effectiveForexRuntimeFlags();
  return {
    effectiveRealForex: flags.realForex,
    armRequested: realForexArmRequested,
    envRealForexAllowed: envRealForexAllowed(),
    releaseBlocked: !flags.realForex,
    releaseBlockReason: flags.realForex
      ? 'LP plug is armed. Quotes, orders, account provisioning, and funding use the LP client.'
      : 'REAL_FOREX stays off until FOREX_LP_BASE_URL, FOREX_LP_API_KEY, and FOREX_REAL_FOREX_ALLOWED are set.',
    checklistComplete,
    checklist,
  };
}

export function assertCanSetRealForexArmRequested(next: boolean, gate: ForexRealForexGateState): void {
  if (!next) return;
  if (!gate.checklistComplete) {
    throw new Error('CHECKLIST_INCOMPLETE');
  }
}

export function resetForexExecutionGateForTests(): void {
  realForexArmRequested = false;
}
