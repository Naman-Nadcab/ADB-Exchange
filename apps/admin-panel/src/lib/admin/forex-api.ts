import { adminFetch } from '@/lib/api';

export type ForexAdminConfigResponse = {
  config: Record<string, unknown>;
  readiness: {
    economicReady: boolean;
    reason: string | null;
    holiday?: unknown;
  };
  runtime: {
    realForex: boolean;
    positionMode: string;
    marketData: {
      enabled: boolean;
      running: boolean;
      intervalMs: number;
      symbols: number;
      providers: string[];
      source: string;
    };
    symbolCount: number;
  };
};

export type ForexAdminOverviewResponse = {
  counts: { openOrders: number; openPositions: number; ledgerAccounts: number };
  readiness: ForexAdminConfigResponse['readiness'];
  posture: {
    source: string;
    executionMode: string;
    realForex: boolean;
    killSwitch: boolean;
    demoFundingEnabled: boolean;
  };
};

export type ForexAdminSystemResponse = {
  readiness: ForexAdminConfigResponse['readiness'];
  marketData: ForexAdminConfigResponse['runtime']['marketData'];
  flags: Record<string, boolean>;
};

export function getForexAdminConfig(token: string | null) {
  return adminFetch<ForexAdminConfigResponse>('/forex/config', { token });
}

export function getForexAdminOverview(token: string | null) {
  return adminFetch<ForexAdminOverviewResponse>('/forex/overview', { token });
}

export function getForexAdminSystem(token: string | null) {
  return adminFetch<ForexAdminSystemResponse>('/forex/system', { token });
}
