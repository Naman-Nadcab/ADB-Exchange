const FOREX_ENUM_KEYS = new Set([
  'ACTIVE',
  'SUSPENDED',
  'CLOSED',
  'DISABLED',
  'PENDING',
  'DEMO',
  'LIVE',
  'REAL',
  'MATCH',
  'MISMATCH',
  'NETTING',
  'HEDGING',
  'ACCOUNT',
  'ALL',
  'INITIAL_FUNDING',
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER',
  'FEE',
  'SWAP',
  'CREDIT',
  'DEBIT',
  'ADJUSTMENT',
  'BULLISH',
  'BEARISH',
  'NEUTRAL',
  'BUY',
  'SELL',
  'LONG',
  'SHORT',
  'NEW',
  'ACCEPTED',
  'WORKING',
  'OPEN',
  'PARTIAL',
  'FILLED',
  'PARTIALLY_FILLED',
  'CANCELLED',
  'CANCELED',
  'CANCEL_PENDING',
  'REJECTED',
  'FAILED',
  'EXPIRED',
  'TRIGGERING',
  'VALIDATING',
  'HIGH',
  'MEDIUM',
  'LOW',
  'HOLIDAY',
  'STALE',
  'LIVE',
  'UNAVAILABLE',
  'LOADING',
  'READY',
  'N_A',
  'SIMULATED',
  'MOCK',
  'MARKET',
  'LIMIT',
  'STOP',
  'STOP_LIMIT',
  'UNDER_REVIEW',
  'APPROVED',
  'PROVISIONING',
]);

/** Exact server sentences that the portal translates. Unknown text stays as returned. */
const SERVER_COPY_KEYS: Record<string, string> = {
  'Live Forex account opening remains gated until broker, funding, and compliance rails are configured.': 'liveOpeningGated',
  'Broker provisioning may proceed when prerequisites are satisfied.': 'liveOpeningReady',
  PROVIDER_OR_RAIL_BLOCKED: 'reasonBlocked',
  PROVIDER_READY: 'reasonReady',
  'Broker provisioning not configured': 'blockerBrokerProvisioning',
  'Live account provisioning unavailable': 'blockerProvisioningUnavailable',
  'Broker trading/investor credential API unavailable': 'blockerCredentials',
  'No external broker/LP adapter enabled': 'blockerNoAdapter',
  'Payment provider for Forex deposits not configured': 'blockerDepositRail',
  'Withdrawal payout rail not configured': 'blockerWithdrawRail',
  'Funding webhook reconciliation not configured': 'blockerWebhook',
  'REAL_FOREX runtime flag must remain off until readiness passes': 'blockerRealForexOff',
  'Live account applications are not accepted in the current environment.': 'liveApplicationNotAccepted',
  'You already have an open live account application.': 'liveApplicationAlreadyOpen',
};

/** Translate a known Forex status or account code. Unknown values stay as returned by the server. */
export function forexEnumLabel(translate: (key: string) => string, value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '_');
  if (FOREX_ENUM_KEYS.has(key)) return translate(key);
  return raw;
}

/** Kind, currency, and a short id — never the raw server label such as "DEMO · USD". */
export function forexAccountOptionLabel(
  translate: (key: string) => string,
  account: { accountKind?: string | null; currency?: string | null; accountId?: string | null },
): string {
  const kind = forexEnumLabel(translate, account.accountKind);
  const currency = String(account.currency ?? '').trim();
  const id = String(account.accountId ?? '').trim();
  const shortId = id.length > 8 ? `${id.slice(0, 8)}…` : id;
  return [kind, currency, shortId].filter(Boolean).join(' · ');
}

/** Translate a known broker or eligibility sentence. Unknown values stay as returned by the server. */
export function forexServerCopy(translate: (key: string) => string, value: string | null | undefined): string {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const key = SERVER_COPY_KEYS[raw];
  return key ? translate(key) : raw;
}
