/**
 * Customer Forex programs: Follow, Partner, Rewards, Apps.
 * Copy / PAMM / MAM share one follow action. Book (A/B) stays on the account group and is not returned here.
 */
import { randomBytes, randomUUID } from 'node:crypto';
import { db } from '../../../lib/database.js';
import { getForexAccountingService } from '../accounting/service.js';
import { resolveForexAccountIdForUser, userOwnsForexAccount } from '../customer/accounts-service.js';
import { ForexLedgerError } from '../ledger/models.js';
import { getForexPositionService } from '../positions/service.js';
import { getForexPricingService } from '../quotes.service.js';

export class ForexProgramError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}

function money(value: unknown): number {
  const n = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function iso(value: unknown): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

async function requireAccount(userId: string, accountId?: string): Promise<string> {
  const id = (accountId?.trim() || (await resolveForexAccountIdForUser(userId)) || '').trim();
  if (!id || !(await userOwnsForexAccount(userId, id))) {
    throw new ForexProgramError('FOREX_ACCOUNT_NOT_FOUND', 'Select a Forex account first');
  }
  return id;
}

function catchLedger(error: unknown): never {
  if (error instanceof ForexLedgerError) {
    throw new ForexProgramError(error.reason, error.message);
  }
  throw error;
}

function accounting() {
  const pricing = getForexPricingService();
  return getForexAccountingService(getForexPositionService(pricing), pricing);
}

type PartnerProfileRow = {
  partner_id: string;
  code: string;
  status: string;
  metadata: { rate_percent?: number } | null;
};

export async function getFollowDesk(userId: string) {
  const managers = await db.query(
    `SELECT manager_id, display_name, style, summary, fee_percent, min_amount, status, owner_user_id
     FROM forex_follow_managers
     WHERE status = 'APPROVED' OR owner_user_id = $1
     ORDER BY status, display_name`,
    [userId]
  );
  const mine = await db.query(
    `SELECT f.follow_id, f.amount, f.stop_percent, f.status, f.started_at, f.stopped_at, f.account_id,
            m.display_name, m.style, m.fee_percent
     FROM forex_follows f
     JOIN forex_follow_managers m ON m.manager_id = f.manager_id
     WHERE f.user_id = $1
     ORDER BY f.started_at DESC
     LIMIT 50`,
    [userId]
  );
  return {
    managers: managers.rows.map((r) => ({
      managerId: String(r.manager_id),
      name: String(r.display_name),
      style: String(r.style),
      summary: String(r.summary ?? ''),
      feePercent: money(r.fee_percent),
      minAmount: money(r.min_amount),
      status: String(r.status),
      mine: r.owner_user_id != null && String(r.owner_user_id) === userId,
    })),
    follows: mine.rows.map((r) => ({
      followId: String(r.follow_id),
      accountId: String(r.account_id),
      name: String(r.display_name),
      style: String(r.style),
      feePercent: money(r.fee_percent),
      amount: money(r.amount),
      stopPercent: money(r.stop_percent),
      status: String(r.status),
      startedAt: iso(r.started_at),
      stoppedAt: iso(r.stopped_at),
    })),
  };
}

export async function applyAsManager(userId: string, input: { name: string; style: string; summary: string; feePercent: number }) {
  const name = input.name.trim();
  const style = input.style.trim().toUpperCase();
  const summary = input.summary.trim();
  if (name.length < 2 || name.length > 80) throw new ForexProgramError('INVALID_NAME', 'Enter a manager name');
  if (style !== 'COPY' && style !== 'PAMM' && style !== 'MAM') throw new ForexProgramError('INVALID_STYLE', 'Choose Copy, PAMM, or MAM');
  if (summary.length < 8) throw new ForexProgramError('INVALID_SUMMARY', 'Describe the strategy in a short sentence');
  const fee = input.feePercent;
  if (!Number.isFinite(fee) || fee < 0 || fee > 50) throw new ForexProgramError('INVALID_FEE', 'Fee must be between 0 and 50 percent');
  const pending = await db.query(
    `SELECT 1 FROM forex_follow_managers WHERE owner_user_id = $1 AND status = 'PENDING' LIMIT 1`,
    [userId]
  );
  if ((pending.rowCount ?? 0) > 0) throw new ForexProgramError('APPLICATION_PENDING', 'You already have an application waiting for approval');
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_follow_managers (manager_id, owner_user_id, display_name, style, summary, fee_percent, min_amount, status)
     VALUES ($1, $2, $3, $4, $5, $6, 100, 'PENDING')`,
    [id, userId, name, style, summary, fee]
  );
  return { managerId: id, status: 'PENDING' };
}

export async function startFollow(userId: string, input: { managerId: string; amount: number; stopPercent: number; accountId?: string }) {
  const accountId = await requireAccount(userId, input.accountId);
  const amount = input.amount;
  const stop = input.stopPercent;
  if (!Number.isFinite(amount) || amount <= 0) throw new ForexProgramError('INVALID_AMOUNT', 'Enter an amount');
  if (!Number.isFinite(stop) || stop <= 0 || stop > 100) throw new ForexProgramError('INVALID_STOP', 'Stop must be between 1 and 100 percent');
  const manager = await db.query(
    `SELECT manager_id, min_amount, status, display_name FROM forex_follow_managers WHERE manager_id = $1::uuid`,
    [input.managerId]
  );
  const row = manager.rows[0];
  if (!row || String(row.status) !== 'APPROVED') throw new ForexProgramError('MANAGER_NOT_AVAILABLE', 'That manager is not open');
  if (amount < money(row.min_amount)) {
    throw new ForexProgramError('BELOW_MINIMUM', `Minimum amount is ${money(row.min_amount)}`);
  }
  const existing = await db.query(
    `SELECT 1 FROM forex_follows WHERE user_id = $1 AND manager_id = $2::uuid AND status = 'ACTIVE' LIMIT 1`,
    [userId, input.managerId]
  );
  if ((existing.rowCount ?? 0) > 0) throw new ForexProgramError('ALREADY_FOLLOWING', 'You are already following this manager');
  const followId = randomUUID();
  await db.query(
    `INSERT INTO forex_follows (follow_id, user_id, account_id, manager_id, amount, stop_percent, status)
     VALUES ($1, $2, $3, $4::uuid, $5, $6, 'ACTIVE')`,
    [followId, userId, accountId, input.managerId, amount.toFixed(2), stop]
  );
  try {
    await accounting().postProgramHold({
      accountId,
      amount: amount.toFixed(2),
      idempotencyKey: `follow-in:${followId}`,
      hold: 'FOLLOW_RESERVE',
      direction: 'IN',
      referenceId: followId,
    });
  } catch (error) {
    await db.query(`DELETE FROM forex_follows WHERE follow_id = $1::uuid`, [followId]);
    catchLedger(error);
  }
  return { followId, status: 'ACTIVE', name: String(row.display_name) };
}

export async function stopFollow(userId: string, followId: string) {
  const res = await db.query(
    `SELECT follow_id, account_id, amount, status FROM forex_follows WHERE follow_id = $1::uuid AND user_id = $2`,
    [followId, userId]
  );
  const row = res.rows[0];
  if (!row) throw new ForexProgramError('FOLLOW_NOT_FOUND', 'Follow not found');
  if (String(row.status) !== 'ACTIVE') return { followId, status: 'STOPPED' };
  try {
    await accounting().postProgramHold({
      accountId: String(row.account_id),
      amount: money(row.amount).toFixed(2),
      idempotencyKey: `follow-out:${followId}`,
      hold: 'FOLLOW_RESERVE',
      direction: 'OUT',
      referenceId: followId,
    });
  } catch (error) {
    catchLedger(error);
  }
  await db.query(`UPDATE forex_follows SET status = 'STOPPED', stopped_at = NOW() WHERE follow_id = $1::uuid`, [followId]);
  return { followId, status: 'STOPPED' };
}

async function ensurePartner(userId: string): Promise<PartnerProfileRow> {
  const existing = await db.query<PartnerProfileRow>(
    `SELECT partner_id, code, status, metadata FROM forex_partner_profiles WHERE user_id = $1 LIMIT 1`,
    [userId]
  );
  const found = existing.rows[0];
  if (found) return found;
  const id = randomUUID();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    try {
      await db.query(
        `INSERT INTO forex_partner_profiles (partner_id, code, label, status, user_id, metadata)
         VALUES ($1, $2, $3, 'active', $4, '{"rate_percent":0}'::jsonb)`,
        [id, code, `Partner ${code}`, userId]
      );
      break;
    } catch (error) {
      const pgCode = (error as { code?: string }).code;
      if (pgCode === '23505' && attempt < 2) continue;
      throw error;
    }
  }
  const created = await db.query<PartnerProfileRow>(
    `SELECT partner_id, code, status, metadata FROM forex_partner_profiles WHERE partner_id = $1`,
    [id]
  );
  const row = created.rows[0];
  if (!row) throw new ForexProgramError('PARTNER_UNAVAILABLE', 'Partner profile could not be opened');
  return row;
}

export async function getPartnerDesk(userId: string) {
  const partner = await ensurePartner(userId);
  const partnerId = String(partner.partner_id);
  const rate = money((partner.metadata as { rate_percent?: number } | null)?.rate_percent);
  const clients = await db.query(
    `SELECT COUNT(*)::int AS n FROM forex_partner_attributions WHERE partner_id = $1::uuid AND effective_to IS NULL`,
    [partnerId]
  );
  const accrued = await db.query(
    `SELECT COALESCE(SUM(commission_amount), 0) AS total
     FROM forex_partner_commission_accruals
     WHERE partner_id = $1::uuid AND status IN ('ACCRUED','ALLOCATED')`,
    [partnerId]
  );
  const reserved = await db.query(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM forex_program_payout_requests
     WHERE partner_id = $1::uuid AND status IN ('PENDING','APPROVED')`,
    [partnerId]
  );
  const available = Math.max(0, money(accrued.rows[0]?.total) - money(reserved.rows[0]?.total));
  const linked = await db.query(
    `SELECT p.code
     FROM forex_partner_attributions a
     JOIN forex_partner_profiles p ON p.partner_id = a.partner_id
     WHERE a.user_id = $1 AND a.effective_to IS NULL
     ORDER BY a.effective_from DESC
     LIMIT 1`,
    [userId]
  );
  const payouts = await db.query(
    `SELECT payout_id, amount, status, created_at FROM forex_program_payout_requests
     WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
    [userId]
  );
  return {
    code: String(partner.code),
    status: String(partner.status),
    ratePercent: rate,
    clients: Number(clients.rows[0]?.n ?? 0),
    availableCommission: available,
    linkedCode: linked.rows[0]?.code ? String(linked.rows[0].code) : null,
    payouts: payouts.rows.map((r) => ({
      payoutId: String(r.payout_id),
      amount: money(r.amount),
      status: String(r.status),
      createdAt: iso(r.created_at),
    })),
  };
}

export async function attachPartnerCode(userId: string, code: string, accountHint?: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z0-9]{4,32}$/.test(normalized)) throw new ForexProgramError('INVALID_CODE', 'Enter the partner code');
  const partner = await db.query(
    `SELECT partner_id, user_id FROM forex_partner_profiles WHERE code = $1 AND status = 'active' LIMIT 1`,
    [normalized]
  );
  const row = partner.rows[0];
  if (!row) throw new ForexProgramError('CODE_NOT_FOUND', 'That partner code is not active');
  if (row.user_id != null && String(row.user_id) === userId) throw new ForexProgramError('OWN_CODE', 'That is your own code');
  const already = await db.query(
    `SELECT 1 FROM forex_partner_attributions WHERE user_id = $1 AND effective_to IS NULL LIMIT 1`,
    [userId]
  );
  if ((already.rowCount ?? 0) > 0) throw new ForexProgramError('ALREADY_ATTRIBUTED', 'A partner is already linked to this account');
  let accountId: string | null = null;
  try {
    const resolved = await resolveForexAccountIdForUser(userId, accountHint);
    if (await userOwnsForexAccount(userId, resolved)) accountId = resolved;
  } catch {
    accountId = null;
  }
  await db.query(
    `INSERT INTO forex_partner_attributions (partner_id, user_id, account_id) VALUES ($1::uuid, $2, $3)`,
    [row.partner_id, userId, accountId]
  );
  return { linked: true };
}

export async function requestPartnerPayout(userId: string, amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) throw new ForexProgramError('INVALID_AMOUNT', 'Enter an amount');
  const desk = await getPartnerDesk(userId);
  if (amount > desk.availableCommission + 1e-8) {
    throw new ForexProgramError('INSUFFICIENT_COMMISSION', 'Amount is above the commission available');
  }
  const partner = await db.query<{ partner_id: string }>(
    `SELECT partner_id FROM forex_partner_profiles WHERE user_id = $1`,
    [userId]
  );
  const partnerRow = partner.rows[0];
  if (!partnerRow) throw new ForexProgramError('PARTNER_NOT_FOUND', 'Open the partner page, then request a payout');
  const id = randomUUID();
  await db.query(
    `INSERT INTO forex_program_payout_requests (payout_id, user_id, partner_id, amount, status)
     VALUES ($1, $2, $3::uuid, $4, 'PENDING')`,
    [id, userId, partnerRow.partner_id, amount.toFixed(2)]
  );
  return { payoutId: id, status: 'PENDING' };
}

export async function getRewardsDesk(userId: string) {
  const rules = await db.query(
    `SELECT rule_id, kind, title, body, amount, rate_percent, withdrawable, usable_as_margin, enabled
     FROM forex_reward_rules ORDER BY kind`
  );
  const grants = await db.query(`SELECT rule_id FROM forex_reward_grants WHERE user_id = $1`, [userId]);
  const granted = new Set(grants.rows.map((r) => String(r.rule_id)));
  const savings = await db.query(
    `SELECT position_id, principal, rate_percent, status, opened_at FROM forex_savings_positions
     WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [userId]
  );
  const activeFollow = await db.query(`SELECT 1 FROM forex_follows WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`, [userId]);
  const partner = await db.query(`SELECT 1 FROM forex_partner_profiles WHERE user_id = $1 LIMIT 1`, [userId]);
  const achievements = await db.query(`SELECT code, title, body, enabled FROM forex_achievements ORDER BY code`);
  const unlocked = new Set<string>(['ACCOUNT']);
  if ((activeFollow.rowCount ?? 0) > 0) unlocked.add('FOLLOW');
  if ((partner.rowCount ?? 0) > 0) unlocked.add('PARTNER');
  const save = savings.rows[0];
  return {
    rules: rules.rows.map((r) => ({
      ruleId: String(r.rule_id),
      kind: String(r.kind),
      title: String(r.title),
      body: String(r.body ?? ''),
      amount: money(r.amount),
      ratePercent: money(r.rate_percent),
      withdrawable: Boolean(r.withdrawable),
      usableAsMargin: Boolean(r.usable_as_margin),
      enabled: Boolean(r.enabled),
      claimed: granted.has(String(r.rule_id)),
    })),
    savings: save
      ? {
          positionId: String(save.position_id),
          principal: money(save.principal),
          ratePercent: money(save.rate_percent),
          openedAt: iso(save.opened_at),
        }
      : null,
    achievements: achievements.rows
      .filter((r) => Boolean(r.enabled))
      .map((r) => ({
        code: String(r.code),
        title: String(r.title),
        body: String(r.body ?? ''),
        unlocked: unlocked.has(String(r.code)),
      })),
  };
}

export async function claimBonus(userId: string, ruleId: string, accountId?: string) {
  const account = await requireAccount(userId, accountId);
  const rule = await db.query(
    `SELECT rule_id, kind, amount, enabled FROM forex_reward_rules WHERE rule_id = $1::uuid`,
    [ruleId]
  );
  const row = rule.rows[0];
  if (!row || String(row.kind) !== 'BONUS' || !row.enabled) throw new ForexProgramError('BONUS_CLOSED', 'This bonus is not open');
  const amount = money(row.amount);
  if (amount <= 0) throw new ForexProgramError('BONUS_CLOSED', 'This bonus has no amount');
  const grantId = randomUUID();
  try {
    await db.query(
      `INSERT INTO forex_reward_grants (grant_id, user_id, rule_id, amount, account_id) VALUES ($1, $2, $3::uuid, $4, $5)`,
      [grantId, userId, ruleId, amount.toFixed(2), account]
    );
  } catch {
    throw new ForexProgramError('ALREADY_CLAIMED', 'This bonus is already on the account');
  }
  try {
    await accounting().credit({
      accountId: account,
      amount: amount.toFixed(2),
      idempotencyKey: `bonus:${userId}:${ruleId}`,
      type: 'DEPOSIT',
      externalReference: grantId,
    });
  } catch (error) {
    await db.query(`DELETE FROM forex_reward_grants WHERE grant_id = $1`, [grantId]);
    catchLedger(error);
  }
  return { grantId, amount };
}

export async function openSavings(userId: string, amount: number, accountId?: string) {
  const account = await requireAccount(userId, accountId);
  if (!Number.isFinite(amount) || amount <= 0) throw new ForexProgramError('INVALID_AMOUNT', 'Enter an amount');
  const rule = await db.query(
    `SELECT rate_percent, enabled FROM forex_reward_rules WHERE kind = 'SAVINGS' AND enabled = TRUE ORDER BY created_at LIMIT 1`
  );
  const row = rule.rows[0];
  if (!row) throw new ForexProgramError('SAVINGS_CLOSED', 'Savings is not open');
  const existing = await db.query(`SELECT 1 FROM forex_savings_positions WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`, [userId]);
  if ((existing.rowCount ?? 0) > 0) throw new ForexProgramError('SAVINGS_OPEN', 'Return the current savings balance before opening another');
  const positionId = randomUUID();
  const rate = money(row.rate_percent);
  await db.query(
    `INSERT INTO forex_savings_positions (position_id, user_id, account_id, principal, rate_percent, status)
     VALUES ($1, $2, $3, $4, $5, 'ACTIVE')`,
    [positionId, userId, account, amount.toFixed(2), rate]
  );
  try {
    await accounting().postProgramHold({
      accountId: account,
      amount: amount.toFixed(2),
      idempotencyKey: `savings-in:${positionId}`,
      hold: 'SAVINGS',
      direction: 'IN',
      referenceId: positionId,
    });
  } catch (error) {
    await db.query(`DELETE FROM forex_savings_positions WHERE position_id = $1::uuid`, [positionId]);
    catchLedger(error);
  }
  return { positionId, ratePercent: rate };
}

export async function returnSavings(userId: string) {
  const res = await db.query(
    `SELECT position_id, account_id, principal, rate_percent, opened_at
     FROM forex_savings_positions WHERE user_id = $1 AND status = 'ACTIVE' LIMIT 1`,
    [userId]
  );
  const row = res.rows[0];
  if (!row) throw new ForexProgramError('SAVINGS_NONE', 'There is no active savings balance');
  const positionId = String(row.position_id);
  const principal = money(row.principal);
  const opened = row.opened_at instanceof Date ? row.opened_at : new Date(String(row.opened_at));
  const days = Math.max(0, (Date.now() - opened.getTime()) / 86_400_000);
  const interest = (principal * money(row.rate_percent) * days) / 365 / 100;
  try {
    await accounting().postProgramHold({
      accountId: String(row.account_id),
      amount: principal.toFixed(2),
      idempotencyKey: `savings-out:${positionId}`,
      hold: 'SAVINGS',
      direction: 'OUT',
      referenceId: positionId,
    });
    if (interest >= 0.01) {
      await accounting().credit({
        accountId: String(row.account_id),
        amount: interest.toFixed(2),
        idempotencyKey: `savings-interest:${positionId}`,
        type: 'DEPOSIT',
        externalReference: positionId,
      });
    }
  } catch (error) {
    catchLedger(error);
  }
  await db.query(`UPDATE forex_savings_positions SET status = 'RETURNED', returned_at = NOW() WHERE position_id = $1::uuid`, [positionId]);
  return { positionId, principal, interest: Number(interest.toFixed(2)) };
}

export async function getAppsDesk(userId: string) {
  const strategies = await db.query(
    `SELECT strategy_id, name, risk_label, summary, status FROM forex_algo_strategies WHERE status = 'APPROVED' ORDER BY name`
  );
  const subs = await db.query(
    `SELECT strategy_id, account_id, enabled FROM forex_algo_subscriptions WHERE user_id = $1`,
    [userId]
  );
  const links = await db.query(`SELECT android_url, ios_url FROM forex_app_links WHERE link_id = TRUE`);
  const link = links.rows[0];
  return {
    strategies: strategies.rows.map((r) => {
      const id = String(r.strategy_id);
      const sub = subs.rows.find((s) => String(s.strategy_id) === id && Boolean(s.enabled));
      return {
        strategyId: id,
        name: String(r.name),
        risk: String(r.risk_label),
        summary: String(r.summary ?? ''),
        armedAccountId: sub ? String(sub.account_id) : null,
      };
    }),
    androidUrl: String(link?.android_url ?? '').trim(),
    iosUrl: String(link?.ios_url ?? '').trim(),
  };
}

export async function setAlgoArmed(userId: string, input: { strategyId: string; enabled: boolean; accountId?: string }) {
  const accountId = await requireAccount(userId, input.accountId);
  const strategy = await db.query(
    `SELECT 1 FROM forex_algo_strategies WHERE strategy_id = $1::uuid AND status = 'APPROVED'`,
    [input.strategyId]
  );
  if ((strategy.rowCount ?? 0) === 0) throw new ForexProgramError('STRATEGY_CLOSED', 'That strategy is not available');
  await db.query(
    `INSERT INTO forex_algo_subscriptions (user_id, account_id, strategy_id, enabled)
     VALUES ($1, $2, $3::uuid, $4)
     ON CONFLICT (user_id, account_id, strategy_id)
     DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = NOW()`,
    [userId, accountId, input.strategyId, input.enabled]
  );
  return { strategyId: input.strategyId, enabled: input.enabled, accountId };
}

export async function submitFeedback(userId: string, message: string) {
  const text = message.trim();
  if (text.length < 8 || text.length > 2000) throw new ForexProgramError('INVALID_MESSAGE', 'Write a short note, at least a sentence');
  const id = randomUUID();
  await db.query(`INSERT INTO forex_program_feedback (feedback_id, user_id, message) VALUES ($1, $2, $3)`, [id, userId, text]);
  return { feedbackId: id };
}

export async function adminProgramsSnapshot() {
  const [managers, follows, payouts, rules, strategies, links, groups, feedback] = await Promise.all([
    db.query(`SELECT manager_id, display_name, style, status, fee_percent, owner_user_id, created_at FROM forex_follow_managers ORDER BY created_at DESC LIMIT 100`),
    db.query(`SELECT status, COUNT(*)::int AS n FROM forex_follows GROUP BY status`),
    db.query(`SELECT payout_id, user_id, amount, status, created_at FROM forex_program_payout_requests ORDER BY created_at DESC LIMIT 50`),
    db.query(`SELECT rule_id, kind, title, enabled, amount, rate_percent, withdrawable FROM forex_reward_rules ORDER BY kind`),
    db.query(`SELECT strategy_id, name, risk_label, status FROM forex_algo_strategies ORDER BY name`),
    db.query(`SELECT android_url, ios_url FROM forex_app_links WHERE link_id = TRUE`),
    db.query(`SELECT group_id, code, label, book FROM forex_account_groups ORDER BY code`),
    db.query(`SELECT feedback_id, user_id, message, created_at FROM forex_program_feedback ORDER BY created_at DESC LIMIT 30`),
  ]);
  return {
    managers: managers.rows,
    followCounts: follows.rows,
    payouts: payouts.rows,
    rules: rules.rows,
    strategies: strategies.rows,
    appLinks: links.rows[0] ?? { android_url: '', ios_url: '' },
    groups: groups.rows,
    feedback: feedback.rows,
  };
}

export async function adminSetManagerStatus(managerId: string, status: string) {
  if (status !== 'APPROVED' && status !== 'SUSPENDED' && status !== 'PENDING') {
    throw new ForexProgramError('INVALID_STATUS', 'Status must be approved, suspended, or pending');
  }
  const res = await db.query(
    `UPDATE forex_follow_managers SET status = $2, updated_at = NOW() WHERE manager_id = $1::uuid RETURNING manager_id, status`,
    [managerId, status]
  );
  if (!res.rows[0]) throw new ForexProgramError('MANAGER_NOT_FOUND', 'Manager not found');
  return res.rows[0];
}

export async function adminSetPartnerRate(userId: string, ratePercent: number) {
  if (!Number.isFinite(ratePercent) || ratePercent < 0 || ratePercent > 100) {
    throw new ForexProgramError('INVALID_FEE', 'Rate must be between 0 and 100');
  }
  const res = await db.query(
    `UPDATE forex_partner_profiles
     SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{rate_percent}', to_jsonb($2::numeric), true), updated_at = NOW()
     WHERE user_id = $1
     RETURNING partner_id, code`,
    [userId, ratePercent]
  );
  if (!res.rows[0]) throw new ForexProgramError('PARTNER_NOT_FOUND', 'Partner profile not found');
  return res.rows[0];
}

export async function adminDecidePayout(payoutId: string, approve: boolean) {
  const status = approve ? 'APPROVED' : 'REJECTED';
  const res = await db.query(
    `UPDATE forex_program_payout_requests
     SET status = $2, decided_at = NOW()
     WHERE payout_id = $1::uuid AND status = 'PENDING'
     RETURNING payout_id, status`,
    [payoutId, status]
  );
  if (!res.rows[0]) throw new ForexProgramError('PAYOUT_NOT_FOUND', 'Pending payout not found');
  return res.rows[0];
}

export async function adminSetRuleEnabled(ruleId: string, enabled: boolean) {
  const res = await db.query(
    `UPDATE forex_reward_rules SET enabled = $2 WHERE rule_id = $1::uuid RETURNING rule_id, enabled`,
    [ruleId, enabled]
  );
  if (!res.rows[0]) throw new ForexProgramError('RULE_NOT_FOUND', 'Rule not found');
  return res.rows[0];
}

export async function adminSetAppLinks(androidUrl: string, iosUrl: string) {
  await db.query(
    `INSERT INTO forex_app_links (link_id, android_url, ios_url) VALUES (TRUE, $1, $2)
     ON CONFLICT (link_id) DO UPDATE SET android_url = EXCLUDED.android_url, ios_url = EXCLUDED.ios_url`,
    [androidUrl.trim(), iosUrl.trim()]
  );
  return { androidUrl: androidUrl.trim(), iosUrl: iosUrl.trim() };
}

export async function adminSetGroupBook(groupId: string, book: 'A' | 'B') {
  const res = await db.query(
    `UPDATE forex_account_groups SET book = $2, updated_at = NOW() WHERE group_id = $1::uuid RETURNING group_id, code, book`,
    [groupId, book]
  );
  if (!res.rows[0]) throw new ForexProgramError('GROUP_NOT_FOUND', 'Group not found');
  return res.rows[0];
}
