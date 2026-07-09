import { ChainIndexer } from './ChainIndexer';
import { CHAIN_CONFIGS } from '../config/chains';
import { query } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Scans recent chain head blocks for deposits independent of sequential block lag.
 * Ensures new user deposits appear within ~1–2 minutes even when the indexer is catching up.
 */
export class RecentDepositScanner {
  private readonly indexers: Map<string, ChainIndexer>;
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  private static readonly SCAN_INTERVAL_MS = 30_000;
  /** dRPC free tier: max ~10k blocks per getLogs — default 8000 (~6h BSC). */
  private static readonly WINDOW_BLOCKS = Math.min(
    8000,
    parseInt(process.env.INDEXER_RECENT_SCAN_BLOCKS || '8000', 10)
  );

  constructor(indexers: Map<string, ChainIndexer>) {
    this.indexers = indexers;
  }

  start(): void {
    if (this.timer) return;
    void this.scanAll();
    this.timer = setInterval(() => void this.scanAll(), RecentDepositScanner.SCAN_INTERVAL_MS);
    logger.info('Recent deposit scanner started', {
      intervalMs: RecentDepositScanner.SCAN_INTERVAL_MS,
      windowBlocks: RecentDepositScanner.WINDOW_BLOCKS,
    });
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async scanAll(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      for (const [chainKey, indexer] of this.indexers) {
        const stats = indexer.getStats() as { isRunning?: boolean };
        if (!stats.isRunning) continue;
        await indexer.scanRecentDeposits(RecentDepositScanner.WINDOW_BLOCKS);
        await new Promise((r) => setTimeout(r, 300));
      }
    } catch (error) {
      logger.warn('Recent deposit scan cycle failed', {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.running = false;
    }
  }

  /** On-demand scan for one user (e.g. deposit page refresh). */
  async scanUser(userId: string, windowBlocks = RecentDepositScanner.WINDOW_BLOCKS): Promise<Record<string, number>> {
    const result = await query(
      `SELECT chain_id, LOWER(address) AS address
       FROM wallets
       WHERE user_id = $1::uuid AND is_active = TRUE AND address IS NOT NULL`,
      [userId]
    );
    const byChain = new Map<string, string[]>();
    for (const row of result.rows as Array<{ chain_id: string; address: string }>) {
      const chain = String(row.chain_id).toLowerCase();
      const list = byChain.get(chain) ?? [];
      if (!list.includes(row.address)) list.push(row.address);
      byChain.set(chain, list);
    }

    const stats: Record<string, number> = {};
    for (const [chainKey, indexer] of this.indexers) {
      const addresses = byChain.get(chainKey);
      if (!addresses?.length) continue;
      stats[chainKey] = await indexer.scanRecentDepositsForAddresses(addresses, windowBlocks);
    }
    return stats;
  }
}

export function isEvmChainKey(chainKey: string): boolean {
  return chainKey in CHAIN_CONFIGS;
}
