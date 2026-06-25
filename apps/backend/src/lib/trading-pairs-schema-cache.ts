/**
 * Caches trading_pairs column layout (token FK vs currency FK).
 */
import { db } from './database.js';

export type TradingPairsJoinMode = 'token' | 'currency';

let cachedMode: TradingPairsJoinMode | null = null;

export async function loadTradingPairsJoinMode(): Promise<TradingPairsJoinMode> {
  if (cachedMode !== null) return cachedMode;
  try {
    const r = await db.query<{ has_token: boolean }>(
      `SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'trading_pairs' AND column_name = 'base_token_id'
      ) AS has_token`
    );
    cachedMode = r.rows[0]?.has_token ? 'token' : 'currency';
  } catch {
    cachedMode = 'token';
  }
  return cachedMode;
}

export function getTradingPairsJoinModeSync(): TradingPairsJoinMode {
  return cachedMode ?? 'token';
}

export function setTradingPairsJoinMode(mode: TradingPairsJoinMode): void {
  cachedMode = mode;
}

export function tradingPairsAssetJoin(alias = 'tp'): {
  joinSql: string;
  baseSymbol: string;
  quoteSymbol: string;
  baseAsset: string;
  quoteAsset: string;
  baseName: string;
  quoteName: string;
  baseLogo: string;
  quoteLogo: string;
  quoteFilterCol: string;
} {
  const mode = getTradingPairsJoinModeSync();
  if (mode === 'token') {
    return {
      joinSql: `JOIN tokens bt ON ${alias}.base_token_id = bt.id JOIN tokens qt ON ${alias}.quote_token_id = qt.id`,
      baseSymbol: 'bt.symbol',
      quoteSymbol: 'qt.symbol',
      baseAsset: 'bt.symbol',
      quoteAsset: 'qt.symbol',
      baseName: 'bt.name',
      quoteName: 'qt.name',
      baseLogo: 'NULL::text',
      quoteLogo: 'NULL::text',
      quoteFilterCol: 'qt.symbol',
    };
  }
  return {
    joinSql: `JOIN currencies bc ON ${alias}.base_currency_id = bc.id JOIN currencies qc ON ${alias}.quote_currency_id = qc.id`,
    baseSymbol: 'bc.symbol',
    quoteSymbol: 'qc.symbol',
    baseAsset: 'bc.symbol',
    quoteAsset: 'qc.symbol',
    baseName: 'bc.name',
    quoteName: 'qc.name',
    baseLogo: 'bc.logo_url',
    quoteLogo: 'qc.logo_url',
    quoteFilterCol: 'qc.symbol',
  };
}
