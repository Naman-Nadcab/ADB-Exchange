import { randomUUID } from 'node:crypto';
import { getForexLiveAccountProvider } from './live-account-provider.registry.js';
import { buildLiveForexReadiness } from './live-funding-readiness.js';
import { getPlatformKycSnapshot } from './platform-kyc.js';

export type ForexLiveApplicationStatus =
  | 'PENDING'
  | 'UNDER_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'PROVISIONING'
  | 'ACTIVE'
  | 'FAILED';

export type ForexLiveAccountApplication = {
  applicationId: string;
  userId: string;
  status: ForexLiveApplicationStatus;
  currency: 'USD';
  positionMode: 'NETTING' | 'HEDGING';
  leverage: string | null;
  groupCode: string | null;
  idempotencyKey: string;
  brokerTradingLogin: string | null;
  brokerServer: string | null;
  internalAccountId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
};

const applications = new Map<string, ForexLiveAccountApplication>();
const idempotencyIndex = new Map<string, string>();

export function resetForexLiveApplicationsForTests(): void {
  applications.clear();
  idempotencyIndex.clear();
}

export function listLiveApplicationsForUser(userId: string): ForexLiveAccountApplication[] {
  return [...applications.values()].filter((a) => a.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getLiveApplicationForUser(userId: string, applicationId: string): ForexLiveAccountApplication | null {
  const app = applications.get(applicationId);
  if (!app || app.userId !== userId) return null;
  return app;
}

export async function createLiveAccountApplication(args: {
  userId: string;
  idempotencyKey: string;
  positionMode?: 'NETTING' | 'HEDGING';
  leverage?: string | null;
  groupCode?: string | null;
}): Promise<{ ok: true; application: ForexLiveAccountApplication } | { ok: false; code: string; message: string }> {
  const key = `LIVE_APP:${args.userId}:${args.idempotencyKey}`;
  const existingId = idempotencyIndex.get(key);
  if (existingId) {
    const existing = applications.get(existingId);
    if (existing) return { ok: true, application: existing };
  }

  const readiness = await buildLiveForexReadiness();
  if (!readiness.capabilities.liveAccountApplication) {
    return { ok: false, code: 'LIVE_APPLICATION_BLOCKED', message: 'Live account applications are not accepted in the current environment.' };
  }

  const kyc = await getPlatformKycSnapshot(args.userId);
  if (!kyc.verified) {
    return { ok: false, code: 'KYC_REQUIRED', message: 'Identity verification must be approved before applying for a live Forex account.' };
  }

  const pending = listLiveApplicationsForUser(args.userId).find((a) =>
    ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROVISIONING'].includes(a.status)
  );
  if (pending) {
    return { ok: false, code: 'APPLICATION_ALREADY_OPEN', message: 'You already have an open live account application.' };
  }

  const now = new Date().toISOString();
  const applicationId = randomUUID();
  const app: ForexLiveAccountApplication = {
    applicationId,
    userId: args.userId,
    status: 'PENDING',
    currency: 'USD',
    positionMode: args.positionMode ?? 'NETTING',
    leverage: args.leverage ?? null,
    groupCode: args.groupCode ?? null,
    idempotencyKey: args.idempotencyKey,
    brokerTradingLogin: null,
    brokerServer: null,
    internalAccountId: null,
    failureReason: null,
    createdAt: now,
    updatedAt: now,
  };
  applications.set(applicationId, app);
  idempotencyIndex.set(key, applicationId);

  const provider = getForexLiveAccountProvider();
  const health = await provider.health();
  if (!health.provisioningAvailable) {
    app.status = 'UNDER_REVIEW';
    app.failureReason = null;
    app.updatedAt = new Date().toISOString();
    return { ok: true, application: app };
  }

  app.status = 'PROVISIONING';
  app.updatedAt = new Date().toISOString();
  const prov = await provider.provisionLiveAccount({
    userId: args.userId,
    applicationId,
    currency: 'USD',
    accountKind: 'LIVE',
    leverage: args.leverage ?? null,
    positionMode: app.positionMode,
    groupCode: args.groupCode ?? null,
    idempotencyKey: args.idempotencyKey,
  });
  if (!prov.ok) {
    app.status = 'FAILED';
    app.failureReason = prov.message;
    app.updatedAt = new Date().toISOString();
    return { ok: true, application: app };
  }

  app.status = 'ACTIVE';
  app.brokerTradingLogin = prov.brokerTradingLogin;
  app.brokerServer = prov.brokerServer;
  app.internalAccountId = prov.internalAccountId;
  app.updatedAt = new Date().toISOString();
  return { ok: true, application: app };
}
