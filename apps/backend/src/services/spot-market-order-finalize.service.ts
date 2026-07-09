/**
 * Market orders must fill immediately or reject — never rest OPEN on the book.
 */
import { Decimal } from '../lib/decimal.js';
import { db } from '../lib/database.js';
import { config } from '../config/index.js';
import { unlockAmountQuote, unlockAmountBase, ROUND_DOWN } from './spot-decimal.js';
import { unlockTradingBalance } from './spot-balance.service.js';
import { cancelOrderRustOnEngine } from './settlement/engine-client.js';
import { getCurrencyIdBySymbol } from '../lib/currency-resolver.js';
import { getSpotOrdersUseMarketSync } from '../lib/spot-schema-cache.js';
import { logger } from '../lib/logger.js';

type OrderRow = {
  id: string;
  user_id: string;
  market: string;
  side: string;
  type: string;
  status: string;
  quantity: string;
  filled_quantity: string;
  price: string | null;
  stop_price: string | null;
  match_engine_id: string | null;
};

async function loadOrderRow(orderId: string): Promise<OrderRow | null> {
  const useMarket = getSpotOrdersUseMarketSync();
  const r = useMarket
    ? await db.query<OrderRow>(
        `SELECT id::text, user_id::text, market, side, type, status, quantity::text, filled_quantity::text,
                price::text, stop_price::text, COALESCE(match_engine_id::text, 'default') AS match_engine_id
         FROM spot_orders WHERE id = $1::uuid LIMIT 1`,
        [orderId]
      )
    : await db.query<OrderRow>(
        `SELECT o.id::text, o.user_id::text, tp.symbol AS market, o.side::text AS side, o.order_type::text AS type,
                o.status::text AS status, o.quantity::text, o.filled_quantity::text, o.price::text, o.stop_price::text,
                COALESCE(o.match_engine_id::text, 'default') AS match_engine_id
         FROM spot_orders o JOIN trading_pairs tp ON tp.id = o.trading_pair_id
         WHERE o.id = $1::uuid LIMIT 1`,
        [orderId]
      );
  return r.rows[0] ?? null;
}

async function computeBuyUnlockResidual(
  client: { query: (text: string, params?: unknown[]) => Promise<{ rows: Array<{ v: string | null }> }> },
  orderId: string,
  legacyPrice: string,
  remainingQty: string
): Promise<string> {
  const r = await client.query(
    `SELECT locked_quote_remaining::text AS v FROM spot_orders WHERE id = $1::uuid FOR UPDATE`,
    [orderId]
  );
  const v = r.rows[0]?.v;
  if (v != null) return new Decimal(v).toDecimalPlaces(8, ROUND_DOWN).toString();
  return unlockAmountQuote(legacyPrice, remainingQty, 8);
}

function isOpenLikeStatus(status: string): boolean {
  const s = (status || '').toLowerCase();
  return s === 'open' || s === 'new' || s === 'partially_filled';
}

export type MarketFinalizeResult =
  | { action: 'none' }
  | { action: 'rejected'; code: 'NO_LIQUIDITY' }
  | { action: 'partial_cancelled'; order: OrderRow };

export type MarketFinalizeOptions = {
  /** When true, drain settlement worker so inline engine matches update filled_quantity before reject. */
  engineProducedMatch?: boolean;
};

async function drainSettlementUntilOrderUpdated(orderId: string, maxMs = 8000): Promise<OrderRow | null> {
  const { runSettlementWorkerOnce } = await import('./settlement/settlement-worker.js');
  const deadline = Date.now() + maxMs;
  let row = await loadOrderRow(orderId);
  while (row && isOpenLikeStatus(row.status) && new Decimal(row.filled_quantity || '0').lte(0) && Date.now() < deadline) {
    await runSettlementWorkerOnce();
    await new Promise((r) => setTimeout(r, 60));
    row = await loadOrderRow(orderId);
  }
  return row;
}

/**
 * After engine placement + settlement pull, cancel any unfilled market remainder.
 * Returns reject when zero fill; partial IOC cancel when partially filled.
 */
export async function finalizeMarketOrderAfterPlace(
  orderId: string,
  userId: string,
  marketSymbol: string,
  opts?: MarketFinalizeOptions
): Promise<MarketFinalizeResult> {
  let row = await loadOrderRow(orderId);
  if (!row) return { action: 'none' };
  const orderType = (row.type || '').toLowerCase();
  if (orderType !== 'market') return { action: 'none' };

  if (opts?.engineProducedMatch && isOpenLikeStatus(row.status)) {
    row = (await drainSettlementUntilOrderUpdated(orderId)) ?? row;
  }
  if (!row || !isOpenLikeStatus(row.status)) return { action: 'none' };

  const filled = new Decimal(row.filled_quantity || '0');
  const qty = new Decimal(row.quantity || '0');
  const remaining = qty.minus(filled).toDecimalPlaces(8, ROUND_DOWN);
  if (remaining.lte(0)) return { action: 'none' };

  if (filled.lte(0)) {
    await cancelUnfilledMarketOrder(row, userId, marketSymbol);
    return { action: 'rejected', code: 'NO_LIQUIDITY' };
  }

  await cancelUnfilledMarketOrder(row, userId, marketSymbol);
  const after = await loadOrderRow(orderId);
  return { action: 'partial_cancelled', order: after ?? row };
}

async function cancelUnfilledMarketOrder(row: OrderRow, userId: string, marketSymbol: string): Promise<void> {
  if (config.rustMatchingEngine.enabled) {
    const mid = String(row.match_engine_id ?? 'default').trim();
    if (mid !== 'node') {
      try {
        await cancelOrderRustOnEngine(row.id, mid, userId);
      } catch (e) {
        logger.warn('market_finalize_engine_cancel_failed', {
          orderId: row.id,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  const m = await db.query<{ base_currency_id: string | null; quote_currency_id: string | null; base_asset: string; quote_asset: string }>(
    `SELECT base_currency_id, quote_currency_id, base_asset, quote_asset FROM spot_markets WHERE symbol = $1`,
    [marketSymbol]
  );
  const mk = m.rows[0];
  const baseId = mk?.base_currency_id ?? (await getCurrencyIdBySymbol(mk?.base_asset ?? '')) ?? '';
  const quoteId = mk?.quote_currency_id ?? (await getCurrencyIdBySymbol(mk?.quote_asset ?? '')) ?? '';

  await db.transaction(async (client) => {
    const fresh = await client.query<OrderRow>(
      getSpotOrdersUseMarketSync()
        ? `SELECT id::text, user_id::text, market, side, type, status, quantity::text, filled_quantity::text,
                  price::text, stop_price::text, COALESCE(match_engine_id::text, 'default') AS match_engine_id
           FROM spot_orders WHERE id = $1::uuid AND user_id = $2::uuid FOR UPDATE`
        : `SELECT o.id::text, o.user_id::text, tp.symbol AS market, o.side::text AS side, o.order_type::text AS type,
                  o.status::text AS status, o.quantity::text, o.filled_quantity::text, o.price::text, o.stop_price::text,
                  COALESCE(o.match_engine_id::text, 'default') AS match_engine_id
           FROM spot_orders o JOIN trading_pairs tp ON tp.id = o.trading_pair_id
           WHERE o.id = $1::uuid AND o.user_id = $2::uuid FOR UPDATE`,
      [row.id, userId]
    );
    const o = fresh.rows[0];
    if (!o || !isOpenLikeStatus(o.status)) return;

    const filledNow = new Decimal(o.filled_quantity || '0');
    const rem = new Decimal(o.quantity).minus(filledNow).toDecimalPlaces(8, ROUND_DOWN);
    if (rem.lte(0)) return;

    const unlockCurrencyId = o.side === 'buy' ? quoteId : baseId;
    const priceForUnlock = o.price ?? o.stop_price ?? '0';
    const unlockAmount =
      o.side === 'buy'
        ? await computeBuyUnlockResidual(client, o.id, priceForUnlock, rem.toString())
        : unlockAmountBase(rem.toString(), 8);

    const cancelStatus = getSpotOrdersUseMarketSync() ? 'CANCELLED' : 'cancelled';
    await client.query(`UPDATE spot_orders SET status = $2, updated_at = NOW() WHERE id = $1::uuid`, [o.id, cancelStatus]);
    await unlockTradingBalance(userId, unlockCurrencyId, unlockAmount, client, {
      referenceType: 'adjustment',
      referenceId: o.id,
    });
  });
}
