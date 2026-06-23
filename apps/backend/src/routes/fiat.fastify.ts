/**
 * Fiat (INR) withdrawal — user-facing routes. Mounted at /api/v1/fiat.
 *
 * Operates on the isolated fiat ledger (fiat_balances/fiat_withdrawals/fiat_ledger);
 * the crypto balance system is never touched. Payouts are admin-settled.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../lib/database.js';
import { config } from '../config/index.js';
import { rateLimitByUser } from '../lib/rate-limit-fastify.js';
import { fiatWithdrawalService, FiatWithdrawalError } from '../services/fiat-withdrawal.service.js';

async function withdrawalsEnabled(): Promise<boolean> {
  try {
    const ft = await db.query<{ is_enabled: boolean | null }>(
      `SELECT is_enabled FROM feature_toggles WHERE feature_key = 'withdrawal.enabled'
       ORDER BY updated_at DESC NULLS LAST, created_at DESC LIMIT 1`
    );
    if (ft.rows.length > 0 && ft.rows[0]!.is_enabled === false) return false;
    const em = await db.query<{ value: unknown }>(
      `SELECT value FROM system_settings WHERE key = 'emergency_disable_withdrawals' LIMIT 1`
    );
    if (em.rows.length > 0) {
      const v = em.rows[0]!.value;
      const on = v === true || v === 'true' || v === 1 || v === '1';
      if (on) return false;
    }
    return true;
  } catch {
    return true;
  }
}

function sendErr(reply: FastifyReply, e: unknown) {
  if (e instanceof FiatWithdrawalError) {
    return reply.status(e.http).send({ success: false, error: { code: e.code, message: e.message } });
  }
  return reply.status(500).send({ success: false, error: { code: 'FIAT_WITHDRAWAL_FAILED', message: 'Operation failed' } });
}

export default async function fiatRoutes(app: FastifyInstance) {
  app.get('/balance', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const balance = await fiatWithdrawalService.getBalance(request.user!.id);
      return reply.send({ success: true, data: balance });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.get('/withdrawals', { preHandler: [app.authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const rows = await fiatWithdrawalService.listUserWithdrawals(request.user!.id);
      return reply.send({ success: true, data: rows });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.post<{
    Body: { amount?: string | number; bankAccountId?: string; twoFactorCode?: string; fund_password?: string; idempotencyKey?: string };
  }>('/withdrawals', {
    preHandler: [app.authenticate, rateLimitByUser('fiat:withdrawal', 5, 3600, { failClosed: config.rateLimit.failClosed })],
  }, async (request, reply) => {
    try {
      if (!(await withdrawalsEnabled())) {
        return reply.status(503).send({ success: false, error: { code: 'WITHDRAWALS_PAUSED', message: 'Withdrawals are temporarily paused.' } });
      }
      if (request.user?.allowWithdraw === false) {
        return reply.status(403).send({ success: false, error: { code: 'API_KEY_NO_WITHDRAW', message: 'This API key cannot withdraw.' } });
      }
      const userId = request.user!.id;
      const body = request.body || {};
      const amountRaw = body.amount != null ? String(body.amount) : '';
      const bankAccountId = typeof body.bankAccountId === 'string' ? body.bankAccountId.trim() : '';

      // 2FA / fund-password gate (enforced only when the user has them enabled)
      const { verifyUser2FA, userHas2FA, userHasFundPassword, verifyFundPassword } = await import('../lib/totp-verify.js');
      let twoFaVerified = false;
      if (await userHas2FA(userId)) {
        const code = typeof body.twoFactorCode === 'string' ? body.twoFactorCode.trim() : '';
        if (!code) return reply.status(400).send({ success: false, error: { code: '2FA_REQUIRED', message: 'Two-factor code is required' } });
        if (!(await verifyUser2FA(userId, code))) return reply.status(400).send({ success: false, error: { code: 'INVALID_2FA', message: 'Invalid two-factor code' } });
        twoFaVerified = true;
      }
      if (await userHasFundPassword(userId)) {
        const fp = typeof body.fund_password === 'string' ? body.fund_password : '';
        if (!fp) return reply.status(400).send({ success: false, error: { code: 'FUND_PASSWORD_REQUIRED', message: 'Fund password is required' } });
        if (!(await verifyFundPassword(userId, fp))) return reply.status(400).send({ success: false, error: { code: 'INVALID_FUND_PASSWORD', message: 'Invalid fund password' } });
      }

      const idempotencyKey = typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 120)
        : (request.headers['idempotency-key'] as string | undefined)?.slice(0, 120) ?? null;

      const w = await fiatWithdrawalService.createWithdrawal({
        userId, amountRaw, bankAccountId: bankAccountId || null, twoFaVerified, idempotencyKey,
      });
      return reply.send({ success: true, data: w });
    } catch (e) {
      return sendErr(reply, e);
    }
  });

  app.post<{ Params: { id: string } }>('/withdrawals/:id/cancel', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    try {
      const w = await fiatWithdrawalService.cancelWithdrawal(request.user!.id, request.params.id);
      return reply.send({ success: true, data: w });
    } catch (e) {
      return sendErr(reply, e);
    }
  });
}
