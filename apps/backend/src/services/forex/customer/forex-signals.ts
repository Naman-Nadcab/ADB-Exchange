/**
 * Signal provider list and saved subscriptions.
 * A subscription is WAITING until a copy engine exists. This module does not place orders.
 */
import { db } from '../../../lib/database.js';
import { userOwnsForexAccount } from './accounts-service.js';
import { forexCopyEngineStatus } from './forex-copy-engine.js';

export type ForexSignalProvider = {
  providerId: string;
  name: string;
  status: 'paused' | 'active';
};

export type ForexSignalSubscription = {
  subscriptionId: string;
  providerId: string;
  providerName: string;
  accountId: string;
  depositPct: string;
  equityStop: string | null;
  slippagePoints: string | null;
  copySlTp: boolean;
  status: 'WAITING' | 'STOPPED';
};

function mapProvider(row: Record<string, unknown>): ForexSignalProvider {
  const status = String(row.status) === 'active' ? 'active' : 'paused';
  return { providerId: String(row.provider_id), name: String(row.name), status };
}

function mapSubscription(row: Record<string, unknown>): ForexSignalSubscription {
  return {
    subscriptionId: String(row.subscription_id),
    providerId: String(row.provider_id),
    providerName: String(row.name ?? ''),
    accountId: String(row.account_id),
    depositPct: String(row.deposit_pct),
    equityStop: row.equity_stop == null ? null : String(row.equity_stop),
    slippagePoints: row.slippage_points == null ? null : String(row.slippage_points),
    copySlTp: row.copy_sl_tp !== false,
    status: String(row.status) === 'STOPPED' ? 'STOPPED' : 'WAITING',
  };
}

export async function listForexSignalProviders(): Promise<ForexSignalProvider[]> {
  try {
    const res = await db.query(
      `SELECT provider_id, name, status FROM forex_signal_providers ORDER BY name`,
    );
    return res.rows.map((row) => mapProvider(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function readForexSignalSubscription(userId: string): Promise<ForexSignalSubscription | null> {
  try {
    const res = await db.query(
      `SELECT s.subscription_id, s.provider_id, p.name, s.account_id, s.deposit_pct,
              s.equity_stop, s.slippage_points, s.copy_sl_tp, s.status
         FROM forex_signal_subscriptions s
         JOIN forex_signal_providers p ON p.provider_id = s.provider_id
        WHERE s.user_id = $1
        ORDER BY s.updated_at DESC
        LIMIT 1`,
      [userId],
    );
    const row = res.rows[0] as Record<string, unknown> | undefined;
    return row ? mapSubscription(row) : null;
  } catch {
    return null;
  }
}

export async function saveForexSignalSubscription(input: {
  userId: string;
  providerId: string;
  accountId: string;
  depositPct: string;
  equityStop?: string | null;
  slippagePoints?: string | null;
  copySlTp: boolean;
}): Promise<
  | { ok: true; subscription: ForexSignalSubscription; copying: false; reason: 'ENGINE_OFF' }
  | { ok: false; code: string; message: string }
> {
  const deposit = Number(input.depositPct);
  if (!Number.isFinite(deposit) || deposit <= 0 || deposit > 100) {
    return { ok: false, code: 'INVALID_DEPOSIT_PCT', message: 'Deposit percent must be between 0 and 100.' };
  }
  const equityRaw = String(input.equityStop ?? '').trim();
  const equity = equityRaw ? Number(equityRaw) : null;
  if (equityRaw && (!Number.isFinite(equity) || (equity ?? 0) < 0)) {
    return { ok: false, code: 'INVALID_EQUITY_STOP', message: 'Equity stop must be zero or greater.' };
  }
  const slipRaw = String(input.slippagePoints ?? '').trim();
  const slip = slipRaw ? Number(slipRaw) : null;
  if (slipRaw && (!Number.isFinite(slip) || (slip ?? 0) < 0)) {
    return { ok: false, code: 'INVALID_SLIPPAGE', message: 'Slippage must be zero or greater.' };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.providerId)) {
    return { ok: false, code: 'PROVIDER_NOT_FOUND', message: 'Signal provider not found.' };
  }
  try {
    if (!(await userOwnsForexAccount(input.userId, input.accountId))) {
      return { ok: false, code: 'FOREX_ACCOUNT_NOT_FOUND', message: 'Account not found.' };
    }
    const provider = await db.query(
    `SELECT provider_id, name, status FROM forex_signal_providers WHERE provider_id = $1::uuid LIMIT 1`,
    [input.providerId],
  );
  const providerRow = provider.rows[0] as Record<string, unknown> | undefined;
  if (!providerRow) return { ok: false, code: 'PROVIDER_NOT_FOUND', message: 'Signal provider not found.' };

  const existing = await db.query(
    `SELECT subscription_id FROM forex_signal_subscriptions
      WHERE user_id = $1 AND provider_id = $2::uuid AND status = 'WAITING'
      LIMIT 1`,
    [input.userId, input.providerId],
  );
  const existingId = (existing.rows[0] as { subscription_id?: string } | undefined)?.subscription_id;
  const saved = existingId
    ? await db.query(
        `UPDATE forex_signal_subscriptions
            SET account_id = $2,
                deposit_pct = $3,
                equity_stop = $4,
                slippage_points = $5,
                copy_sl_tp = $6,
                updated_at = NOW()
          WHERE subscription_id = $1::uuid
          RETURNING subscription_id, provider_id, account_id, deposit_pct, equity_stop, slippage_points, copy_sl_tp, status`,
        [existingId, input.accountId, deposit.toFixed(2), equity, slip, input.copySlTp],
      )
    : await db.query(
        `INSERT INTO forex_signal_subscriptions
           (provider_id, user_id, account_id, deposit_pct, equity_stop, slippage_points, copy_sl_tp, status)
         VALUES ($1::uuid, $2, $3, $4, $5, $6, $7, 'WAITING')
         RETURNING subscription_id, provider_id, account_id, deposit_pct, equity_stop, slippage_points, copy_sl_tp, status`,
        [input.providerId, input.userId, input.accountId, deposit.toFixed(2), equity, slip, input.copySlTp],
      );
  const row = saved.rows[0] as Record<string, unknown>;
  const engine = forexCopyEngineStatus();
  return {
    ok: true,
    copying: engine.armed,
    reason: engine.reason,
    subscription: mapSubscription({ ...row, name: providerRow.name }),
  };
  } catch {
    return { ok: false, code: 'SIGNALS_NOT_READY', message: 'Signal subscriptions are not available yet.' };
  }
}

export async function createForexSignalProvider(name: string): Promise<ForexSignalProvider> {
  const label = name.trim();
  if (label.length < 2 || label.length > 128) throw new Error('INVALID_NAME');
  const res = await db.query(
    `INSERT INTO forex_signal_providers (name, status) VALUES ($1, 'paused') RETURNING provider_id, name, status`,
    [label],
  );
  return mapProvider(res.rows[0] as Record<string, unknown>);
}

export async function setForexSignalProviderStatus(providerId: string, status: 'paused' | 'active'): Promise<ForexSignalProvider> {
  const res = await db.query(
    `UPDATE forex_signal_providers SET status = $2 WHERE provider_id = $1::uuid RETURNING provider_id, name, status`,
    [providerId, status],
  );
  const row = res.rows[0] as Record<string, unknown> | undefined;
  if (!row) throw new Error('PROVIDER_NOT_FOUND');
  return mapProvider(row);
}
