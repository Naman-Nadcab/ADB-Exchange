import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { CHAIN_CONFIGS, loadChainRpcOverridesFromDb } from './config/chains';
import { query } from './config/database';
import { ChainIndexer } from './services/ChainIndexer';
import { ConfirmationTracker } from './services/ConfirmationTracker';
import { RecentDepositScanner } from './services/RecentDepositScanner';
import { BitcoinIndexer } from './services/BitcoinIndexer';
import { TronIndexer } from './services/TronIndexer';
import { startApiServer } from './api/server';
import { logger } from './utils/logger';

type NonEvmIndexer = BitcoinIndexer | TronIndexer;

class IndexerManager {
  private indexers: Map<string, ChainIndexer> = new Map();
  private nonEvmIndexers: Map<string, NonEvmIndexer> = new Map();
  private confirmationTracker: ConfirmationTracker;
  private recentDepositScanner: RecentDepositScanner | null = null;
  private isShuttingDown: boolean = false;

  constructor() {
    this.confirmationTracker = new ConfirmationTracker();
  }

  async initialize(): Promise<void> {
    logger.info('🚀 Starting EVM Indexer...');

    // Ensure database tables exist
    await this.initializeDatabase();

    // Override hardcoded RPC/WS URLs with values from the `chains` DB table.
    await loadChainRpcOverridesFromDb();

    // Expose /health before chain WebSockets (confirmation tracker can be slow; Docker healthcheck needs HTTP early).
    startApiServer(this);

    const activeEvmChainIds = await this.loadActiveEvmChainIds();

    // Initialize indexers only for active EVM chains (same gate as Bitcoin/Tron indexers).
    for (const [chainKey, config] of Object.entries(CHAIN_CONFIGS)) {
      if (activeEvmChainIds != null && !this.isEvmChainActive(chainKey, activeEvmChainIds)) {
        logger.info(`Skipping ${config.name} indexer — chain not active in DB`, { chainKey });
        continue;
      }
      const indexer = new ChainIndexer(chainKey, config);
      this.indexers.set(chainKey, indexer);
    }

    // Start all indexers
    const startPromises = Array.from(this.indexers.entries()).map(async ([chainKey, indexer]) => {
      try {
        await indexer.start();
        logger.info(`✅ ${CHAIN_CONFIGS[chainKey].name} indexer started`);
      } catch (error) {
        logger.error(`❌ Failed to start ${chainKey} indexer`, { error });
      }
    });

    // Tron and Bitcoin must not wait for a slow EVM RPC. A hung chain head
    // request used to keep USDT-TRC20 from being watched at all.
    const nonEvmReady = this.startNonEvmIndexers();
    await Promise.all([...startPromises, nonEvmReady]);

    // Live head scanner — detects deposits within ~1 min even when block lag is large.
    this.recentDepositScanner = new RecentDepositScanner(this.indexers);
    this.recentDepositScanner.start();

    // Start confirmation tracker
    await this.confirmationTracker.start();

    logger.info('🎉 All indexers started successfully!');
    this.printStatus();
  }

  /** When DB is reachable, only chains with is_active=TRUE are indexed. null = fail-open (start all). */
  private async loadActiveEvmChainIds(): Promise<Set<string> | null> {
    try {
      const res = await query(
        `SELECT id FROM chains WHERE is_active = TRUE AND type = 'evm'`
      );
      return new Set(res.rows.map((r: { id: string }) => String(r.id).toLowerCase()));
    } catch (error) {
      logger.warn('Failed to load active EVM chains; starting all configured indexers', { error });
      return null;
    }
  }

  private isEvmChainActive(chainKey: string, activeIds: Set<string>): boolean {
    const k = chainKey.toLowerCase();
    if (activeIds.has(k)) return true;
    // DB seed may use legacy id "eth" while indexer key is "ethereum".
    if (k === 'ethereum' && activeIds.has('eth')) return true;
    return false;
  }

  private async startNonEvmIndexers(): Promise<void> {
    // Only bring a chain up if its row is active. Avoids polling disabled chains.
    const active = await query(
      `SELECT id FROM chains WHERE is_active = TRUE AND id IN ('bitcoin', 'tron')`
    );
    const activeIds = new Set(active.rows.map((r: any) => r.id));

    if (activeIds.has('bitcoin')) {
      const btc = new BitcoinIndexer();
      try {
        await btc.start();
        this.nonEvmIndexers.set('bitcoin', btc);
        logger.info('✅ Bitcoin indexer started');
      } catch (e) {
        logger.error('❌ Failed to start Bitcoin indexer', { error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      logger.info('Bitcoin chain not active in DB — skipping Bitcoin indexer');
    }

    if (activeIds.has('tron')) {
      const tron = new TronIndexer();
      try {
        await tron.start();
        this.nonEvmIndexers.set('tron', tron);
        logger.info('✅ Tron indexer started');
      } catch (e) {
        logger.error('❌ Failed to start Tron indexer', { error: e instanceof Error ? e.message : String(e) });
      }
    } else {
      logger.info('Tron chain not active in DB — skipping Tron indexer');
    }
  }

  private async initializeDatabase(): Promise<void> {
    try {
      // Create indexer_state table if not exists
      await query(`
        CREATE TABLE IF NOT EXISTS indexer_state (
          chain_id VARCHAR(50) PRIMARY KEY,
          last_block BIGINT NOT NULL DEFAULT 0,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      try {
        await query(`CREATE INDEX IF NOT EXISTS idx_deposits_user_id ON deposits(user_id)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_deposits_status ON deposits(status)`);
        await query(`CREATE INDEX IF NOT EXISTS idx_deposits_to_address ON deposits(to_address)`);
      } catch (e) {
        // Indexes might already exist
      }

      // Ensure deposits table has chain_id column (newer schema uses chain_id VARCHAR instead of blockchain_id UUID)
      await query(`ALTER TABLE deposits ADD COLUMN IF NOT EXISTS chain_id VARCHAR(20)`);

      // Ensure UNIQUE constraint on (chain_id, tx_hash, to_address) to prevent duplicate deposits
      await query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint WHERE conname = 'deposits_unique_chain_tx_to' AND conrelid = 'deposits'::regclass
          ) THEN
            ALTER TABLE deposits ADD CONSTRAINT deposits_unique_chain_tx_to UNIQUE (chain_id, tx_hash, to_address);
          END IF;
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
      `);

      // Unknown ERC-20 deposits queue: persisted when token/currency is not yet registered (never silent drop).
      await query(`
        CREATE TABLE IF NOT EXISTS indexer_pending_token_deposits (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chain_id VARCHAR(50) NOT NULL,
          tx_hash VARCHAR(255) NOT NULL,
          token_address VARCHAR(255) NOT NULL,
          from_address VARCHAR(255),
          to_address VARCHAR(255) NOT NULL,
          amount NUMERIC(36,18) NOT NULL,
          symbol VARCHAR(64),
          decimals INT,
          block_number BIGINT NOT NULL,
          block_timestamp TIMESTAMPTZ,
          user_id UUID,
          wallet_id UUID,
          status VARCHAR(32) NOT NULL DEFAULT 'pending_review',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT indexer_pending_token_deposits_unique UNIQUE (chain_id, tx_hash, to_address)
        )
      `);
      await query(`
        CREATE INDEX IF NOT EXISTS idx_indexer_pending_token_deposits_status
        ON indexer_pending_token_deposits(status, created_at DESC)
      `);

      logger.info('Database tables initialized');
    } catch (error) {
      logger.error('Failed to initialize database tables', { error });
      throw error;
    }
  }

  private printStatus(): void {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Indexer Status');
    console.log('='.repeat(60));
    
    for (const [chainKey, indexer] of this.indexers) {
      const stats = indexer.getStats() as any;
      console.log(`
  ${stats.chain}:
    Chain ID: ${stats.chainId}
    Status: ${stats.isRunning ? '🟢 Running' : '🔴 Stopped'}
    Watched Addresses: ${stats.watchedAddresses}
    Token Contracts: ${stats.tokenContracts}
    Last Block: ${stats.lastProcessedBlock}
`);
    }
    for (const [chainKey, indexer] of this.nonEvmIndexers) {
      const stats = indexer.getStats() as any;
      console.log(`
  ${stats.chain}:
    Chain ID: ${stats.chainId}
    Status: ${stats.isRunning ? '🟢 Running' : '🔴 Stopped'}
    Watched Addresses: ${stats.watchedAddresses}
    Token Contracts: ${stats.tokenContracts}
    Last Block/Height: ${stats.lastProcessedBlock}
`);
    }
    console.log('='.repeat(60) + '\n');
  }

  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;
    
    logger.info('Shutting down indexers...');

    this.recentDepositScanner?.stop();
    
    // Stop confirmation tracker
    await this.confirmationTracker.stop();
    
    // Stop all indexers (EVM + non-EVM)
    const stopPromises: Promise<void>[] = [
      ...Array.from(this.indexers.values()).map((indexer) => indexer.stop()),
      ...Array.from(this.nonEvmIndexers.values()).map((indexer) => indexer.stop()),
    ];
    await Promise.all(stopPromises);
    
    logger.info('All indexers stopped');
    process.exit(0);
  }

  // API methods for external control
  async addWatchedAddress(chainId: string, address: string): Promise<boolean> {
    const evm = this.indexers.get(chainId);
    if (evm) {
      await evm.addWatchedAddress(address);
      return true;
    }
    const nonEvm = this.nonEvmIndexers.get(chainId);
    if (nonEvm) {
      await nonEvm.addWatchedAddress(address);
      return true;
    }
    logger.warn(`No indexer for chain ${chainId}`);
    return false;
  }

  getStats(): object {
    const stats: Record<string, object> = {};

    for (const [chainKey, indexer] of this.indexers) {
      stats[chainKey] = indexer.getStats();
    }
    for (const [chainKey, indexer] of this.nonEvmIndexers) {
      stats[chainKey] = indexer.getStats();
    }

    return stats;
  }

  async scanUserDeposits(userId: string): Promise<Record<string, number>> {
    if (!this.recentDepositScanner) return {};
    return this.recentDepositScanner.scanUser(userId);
  }
}

// Main entry point
const manager = new IndexerManager();

// Handle graceful shutdown
process.on('SIGINT', () => manager.shutdown());
process.on('SIGTERM', () => manager.shutdown());
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  manager.shutdown();
});
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
});

// Start the indexer
manager.initialize().catch((error) => {
  logger.error('Failed to initialize indexer', { error });
  process.exit(1);
});

export { manager as indexerManager };
