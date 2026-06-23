/**
 * Integrations Center — RPC bridge (M3, staging-gated).
 *
 * The LIVE deposit/withdrawal and indexer paths read RPC endpoints from the
 * `chains` table (chains.rpc_url), NOT from dynamic-config.getRpcConfigs().
 * To make the Integrations Center the single source of truth WITHOUT a risky
 * runtime refactor, we keep `chains` in sync whenever an admin saves an RPC
 * provider in the Center. This is best-effort and fully defensive — it never
 * throws into the request path and never disables an active chain.
 */
import { db } from '../lib/database.js';
import { logger } from '../lib/logger.js';

/**
 * Sync a Center RPC provider into the chains table.
 * @param chainSlug  api_settings.provider (e.g. 'ethereum', 'bsc', 'polygon') — maps to chains.id
 * @param rpcUrl     primary RPC URL saved in the Center
 * @param extra      additional_config (may carry ws_url)
 */
export async function syncRpcToChains(
  chainSlug: string,
  rpcUrl: string,
  extra: Record<string, string>,
): Promise<{ updated: boolean }> {
  const slug = (chainSlug || '').trim().toLowerCase();
  const url = (rpcUrl || '').trim();
  if (!slug || !url) return { updated: false };

  const wsUrl = (extra?.ws_url || extra?.wsUrl || '').trim() || null;

  try {
    // Match by chain id (slug) first, then by case-insensitive name.
    const res = await db.query<{ id: string }>(
      `UPDATE chains
         SET rpc_url = $2,
             ws_url = COALESCE($3, ws_url),
             updated_at = NOW()
       WHERE LOWER(id) = $1 OR LOWER(name) = $1
       RETURNING id`,
      [slug, url, wsUrl],
    );
    const updated = (res.rows?.length ?? 0) > 0;
    if (updated) {
      logger.info('RPC→chains bridge synced', { chainSlug: slug, chains: res.rows.map((r) => r.id) });
    } else {
      logger.warn('RPC→chains bridge: no matching chain row', { chainSlug: slug });
    }
    return { updated };
  } catch (e) {
    logger.warn('RPC→chains bridge query failed', { chainSlug: slug, error: e instanceof Error ? e.message : String(e) });
    return { updated: false };
  }
}
