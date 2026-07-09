/**
 * Liquidity bot system user — must remain tradable for hybrid/MM orderbook depth.
 */
import { db } from '../lib/database.js';
import { logger, securityLog } from '../lib/logger.js';
import { config } from '../config/index.js';
import { getLiquidityBotUserId } from '../lib/liquidity-bot-rate-limit.js';

export async function resolveLiquidityBotUserId(): Promise<string | null> {
  if (!config.liquidityBot.apiKey) return null;
  return getLiquidityBotUserId();
}

export async function isLiquidityBotUser(userId: string): Promise<boolean> {
  const botId = await resolveLiquidityBotUserId();
  return botId != null && botId === userId;
}

/**
 * Clear spot trading suspension for the liquidity bot user when no active integrity violation exists.
 */
export async function ensureLiquidityBotTradingActive(): Promise<{ unsuspended: boolean; reason?: string }> {
  if (!config.liquidityBot.enabled || !config.liquidityBot.apiKey) {
    return { unsuspended: false, reason: 'bot_disabled' };
  }
  const botId = await resolveLiquidityBotUserId();
  if (!botId) {
    return { unsuspended: false, reason: 'bot_user_not_found' };
  }

  const neg = await db.query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM user_balances
     WHERE user_id = $1::uuid AND (available_balance < 0 OR locked_balance < 0)`,
    [botId]
  );
  if (parseInt(neg.rows[0]?.n ?? '0', 10) > 0) {
    logger.error('Liquidity bot user has negative balances — not auto-unsuspending', { userId: botId });
    return { unsuspended: false, reason: 'negative_balance' };
  }

  const up = await db.query(
    `UPDATE users SET spot_trading_suspended_at = NULL, spot_trading_suspend_reason = NULL
     WHERE id = $1::uuid AND spot_trading_suspended_at IS NOT NULL AND deleted_at IS NULL`,
    [botId]
  );
  if ((up.rowCount ?? 0) > 0) {
    securityLog('liquidity_bot_trading_unsuspended', 'high', { userId: botId });
    logger.warn('Liquidity bot user spot trading unsuspended (was blocked by integrity engine)', { userId: botId });
    return { unsuspended: true };
  }
  return { unsuspended: false, reason: 'already_active' };
}
