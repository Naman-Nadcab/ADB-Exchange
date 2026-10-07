import { randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { getForexLiveAccountProvider } from './live-account-provider.registry.js';
import { buildLiveForexReadiness } from './live-funding-readiness.js';
import { assertForexLiveKyc } from './forex-kyc-policy.service.js';

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

function rowToApplication(row: Record<string, unknown>): ForexLiveAccountApplication {
  const mode = row.position_mode === 'HEDGING' ? 'HEDGING' : 'NETTING';
  return {
    applicationId: String(row.application_id),
    userId: String(row.user_id),
    status: String(row.status) as ForexLiveApplicationStatus,
    currency: 'USD',
    positionMode: mode,
    leverage: row.leverage == null ? null : String(row.leverage),
    groupCode: row.group_code == null ? null : String(row.group_code),
    idempotencyKey: String(row.idempotency_key),
    brokerTradingLogin: row.broker_trading_login == null ? null : String(row.broker_trading_login),
    brokerServer: row.broker_server == null ? null : String(row.broker_server),
    internalAccountId: row.internal_account_id == null ? null : String(row.internal_account_id),
    failureReason: row.failure_reason == null ? null : String(row.failure_reason),
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
    updatedAt: row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at),
  };
}

/** Restart-safe load. A missing table leaves the in-memory copy in place. */
export async function hydrateLiveApplicationsFromDb(): Promise<void> {
  try {
    const res = await db.query(`SELECT * FROM forex_live_applications ORDER BY created_at DESC LIMIT 500`);
    for (const row of res.rows as Record<string, unknown>[]) {
      const app = rowToApplication(row);
      if (applications.has(app.applicationId)) continue;
      applications.set(app.applicationId, app);
      idempotencyIndex.set(`LIVE_APP:${app.userId}:${app.idempotencyKey}`, app.applicationId);
    }
  } catch {
    /* unit tests and a not-yet-migrated database keep the memory map */
  }
}

async function writeLiveApplication(app: ForexLiveAccountApplication): Promise<void> {
  try {
    await db.query(
      `INSERT INTO forex_live_applications (
         application_id, user_id, status, currency, position_mode, leverage, group_code, idempotency_key,
         broker_trading_login, broker_server, internal_account_id, failure_reason, created_at, updated_at
       ) VALUES ($1,$2,$3,'USD',$4,$5,$6,$7,$8,$9,$10,$11,$12::timestamptz,$13::timestamptz)
       ON CONFLICT (application_id) DO UPDATE SET
         status = EXCLUDED.status,
         broker_trading_login = EXCLUDED.broker_trading_login,
         broker_server = EXCLUDED.broker_server,
         internal_account_id = EXCLUDED.internal_account_id,
         failure_reason = EXCLUDED.failure_reason,
         updated_at = EXCLUDED.updated_at`,
      [
        app.applicationId,
        app.userId,
        app.status,
        app.positionMode,
        app.leverage,
        app.groupCode,
        app.idempotencyKey,
        app.brokerTradingLogin,
        app.brokerServer,
        app.internalAccountId,
        app.failureReason,
        app.createdAt,
        app.updatedAt,
      ]
    );
  } catch {
    /* memory is the working copy when the table is absent */
  }
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
  await hydrateLiveApplicationsFromDb();
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

  const kycGate = await assertForexLiveKyc(args.userId);
  if (!kycGate.ok) {
    return { ok: false, code: kycGate.code, message: kycGate.message };
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
  await writeLiveApplication(app);

  const provider = getForexLiveAccountProvider();
  const health = await provider.health();
  if (!health.provisioningAvailable) {
    app.status = 'UNDER_REVIEW';
    app.failureReason = null;
    app.updatedAt = new Date().toISOString();
    await writeLiveApplication(app);
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
    await writeLiveApplication(app);
    return { ok: true, application: app };
  }

  app.status = 'ACTIVE';
  app.brokerTradingLogin = prov.brokerTradingLogin;
  app.brokerServer = prov.brokerServer;
  app.internalAccountId = prov.internalAccountId;
  app.updatedAt = new Date().toISOString();
  await writeLiveApplication(app);
  return { ok: true, application: app };
}
