import { ethers, WebSocketProvider, JsonRpcProvider, Log, Block, TransactionResponse, zeroPadValue, getAddress } from 'ethers';
import { getCachedBlockNumber, getCachedBlockTimestamp, getEvmRpcProvider } from '../lib/evm-rpc-pool.js';
import { ChainConfig, ERC20_TRANSFER_TOPIC } from '../config/chains';
import { query } from '../config/database';
import { logger } from '../utils/logger';
import { emailService } from './EmailService';

export class ChainIndexer {
  private chainKey: string;
  private config: ChainConfig;
  private wsProvider: WebSocketProvider | null = null;
  private httpProvider: JsonRpcProvider;
  private watchedAddresses: Set<string> = new Set();
  private tokenContracts: Map<string, { symbol: string; decimals: number }> = new Map();
  /** On-chain metadata fetched once per contract (unknown tokens not yet in DB). */
  private fetchedTokenMetadata: Map<string, { symbol: string; decimals: number }> = new Map();
  private isRunning: boolean = false;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;
  /** Prevents parallel connectWebSocket / reconnect timer storms that block the HTTP health server. */
  private wsConnectInFlight = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private wsDisabled = false;
  private lastProcessedBlock: number = 0;
  /** HTTP polling fallback: drives block processing + heartbeat when WebSocket is unavailable. */
  private pollTimer: NodeJS.Timeout | null = null;
  private watchReloadTimer: NodeJS.Timeout | null = null;
  private readonly pollIntervalMs: number;
  /** When WS delivered a block recently, HTTP poll only heartbeats (avoids duplicate RPC). */
  private wsHealthyUntil = 0;
  /** Single-flight guard — prevents concurrent processBlock storms on fast L2 chains. */
  private blockProcessInFlight = false;
  private pendingBlock: number | null = null;
  /** Back off all block fetches after provider rate-limits (429 / CU exceeded). */
  private rateLimitedUntil = 0;
  private static readonly MAX_BLOCKS_PER_HTTP_TICK = 3;
  private static readonly MAX_BLOCKS_PER_HTTP_TICK_CATCHUP = 120;
  private static readonly LAG_CATCHUP_THRESHOLD = 400;
  private static readonly RATE_LIMIT_BACKOFF_MS = 60_000;
  private static readonly WATCH_RELOAD_MS = 60_000;

  constructor(chainKey: string, config: ChainConfig) {
    this.chainKey = chainKey;
    this.config = config;
    // Explicit network avoids auto-detection handshake that burns requests on rate-limited RPCs.
    this.httpProvider = getEvmRpcProvider(config.rpcUrl, config.id);
    // Fast L2 chains (e.g. Arbitrum) must not poll every few seconds — WS handles live blocks.
    const isFastL2 = config.blockTime > 0 && config.blockTime < 2;
    this.pollIntervalMs = isFastL2
      ? 20_000
      : Math.min(30_000, Math.max(8_000, Math.round((config.blockTime || 12) * 2_000)));
  }

  private markWsHealthy(): void {
    this.wsHealthyUntil = Date.now() + 60_000;
  }

  private isWsHealthy(): boolean {
    return Date.now() < this.wsHealthyUntil;
  }

  private isRateLimitError(error: unknown): boolean {
    const s = error instanceof Error ? `${error.message} ${(error as { code?: string }).code ?? ''}` : String(error);
    const blob = s + JSON.stringify(error);
    return /429|rate limit|compute units|too many requests|exceeded.*capacity|limit exceeded|-32005/i.test(blob);
  }

  /** Archive / range RPC errors — skip block or batch without stalling the whole chain. */
  private isSkippableRpcError(error: unknown): boolean {
    const s = error instanceof Error ? error.message : String(error);
    const blob = s + JSON.stringify(error);
    return /archive requests require|403 forbidden|-32602|header not found|invalid block range|block not found/i.test(blob);
  }

  async start(): Promise<void> {
    logger.info(`Starting indexer for ${this.config.name}`, { chainId: this.config.id });
    
    try {
      // Load watched addresses from database
      await this.loadWatchedAddresses();
      
      // Load token contracts
      await this.loadTokenContracts();
      
      // Get last processed block
      await this.loadLastProcessedBlock();

      // If RPC was down for a long time, batch-scan missed ERC-20 deposits before live polling.
      await this.catchUpIfLagging();
      
      // Connect WebSocket (best-effort: some RPCs block WS on free tier).
      try {
        await this.connectWebSocket();
      } catch (error) {
        logger.warn(`WebSocket unavailable for ${this.config.name}; falling back to HTTP polling`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Always run HTTP polling fallback; it processes new blocks + refreshes the
      // indexer_state heartbeat, covering the case where WebSocket is down or rate-limited.
      this.startHttpPolling();
      this.startWatchlistReload();

      this.isRunning = true;
      logger.info(`Indexer started for ${this.config.name}`, { 
        watchedAddresses: this.watchedAddresses.size,
        tokens: this.tokenContracts.size,
        lastBlock: this.lastProcessedBlock
      });
    } catch (error) {
      logger.error(`Failed to start indexer for ${this.config.name}`, { error });
      throw error;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private async connectWebSocket(): Promise<void> {
    if (this.wsDisabled || !this.isRunning || this.wsConnectInFlight) return;
    this.wsConnectInFlight = true;
    try {
      const prev = this.wsProvider;
      this.wsProvider = null;
      if (prev) {
        prev.removeAllListeners();
        await prev.destroy().catch(() => {});
      }

      const provider = new WebSocketProvider(this.config.wssUrl);

      provider.on('block', (blockNumber: number) => {
        this.markWsHealthy();
        void this.scheduleProcessBlock(Number(blockNumber)).catch((err) => {
          logger.warn(`Block handler error for ${this.config.name}`, {
            error: err instanceof Error ? err.message : String(err),
          });
        });
      });

      let disconnectHandled = false;
      const onDisconnect = (kind: 'error' | 'close', error?: Error) => {
        if (disconnectHandled || !this.isRunning) return;
        disconnectHandled = true;
        if (kind === 'error') {
          logger.error(`WebSocket error on ${this.config.name}`, { error: error?.message });
        } else {
          logger.warn(`WebSocket closed for ${this.config.name}`);
        }
        this.scheduleReconnect();
      };

      const ws = provider.websocket as unknown as { on?: (ev: string, cb: (e?: Error) => void) => void };
      if (typeof ws?.on === 'function') {
        ws.on('error', (error?: Error) => onDisconnect('error', error));
        ws.on('close', () => onDisconnect('close'));
      }

      this.wsProvider = provider;
      this.reconnectAttempts = 0;
      logger.info(`WebSocket connected for ${this.config.name}`);
    } catch (error) {
      logger.error(`Failed to connect WebSocket for ${this.config.name}`, { error });
      this.scheduleReconnect();
    } finally {
      this.wsConnectInFlight = false;
    }
  }

  private scheduleReconnect(): void {
    if (!this.isRunning || this.wsDisabled) return;
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    if (this.reconnectAttempts > this.maxReconnectAttempts) {
      this.wsDisabled = true;
      logger.warn(`WebSocket disabled for ${this.config.name} after max reconnect attempts; HTTP polling only`);
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    logger.info(`Reconnecting to ${this.config.name} in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectWebSocket();
    }, delay);
  }

  private async loadWatchedAddresses(): Promise<void> {
    try {
      const result = await query(`
        SELECT DISTINCT LOWER(w.address) as address 
        FROM wallets w
        WHERE w.chain_id = $1 AND w.address IS NOT NULL AND w.is_active = TRUE
      `, [this.chainKey]);
      
      result.rows.forEach(row => {
        this.watchedAddresses.add(row.address.toLowerCase());
      });
      
      logger.info(`Loaded ${this.watchedAddresses.size} watched addresses for ${this.config.name}`);
    } catch (error) {
      logger.error(`Failed to load watched addresses for ${this.config.name}`, { error });
    }
  }

  private async loadTokenContracts(): Promise<void> {
    try {
      const result = await query(`
        SELECT LOWER(t.contract_address) as address, t.symbol, t.decimals 
        FROM tokens t
        WHERE t.contract_address IS NOT NULL 
          AND t.contract_address != '' 
          AND t.is_active = TRUE
          AND t.chain_id = $1
      `, [this.chainKey]);
      
      result.rows.forEach(row => {
        if (row.address) {
          this.tokenContracts.set(row.address.toLowerCase(), {
            symbol: row.symbol,
            decimals: row.decimals || 18
          });
        }
      });
      
      logger.info(`Loaded ${this.tokenContracts.size} token contracts for ${this.config.name}`);
    } catch (error) {
      logger.error(`Failed to load token contracts for ${this.config.name}`, { error });
    }
  }

  private async loadLastProcessedBlock(): Promise<void> {
    try {
      const result = await query(`
        SELECT last_block FROM indexer_state WHERE chain_id = $1
      `, [this.chainKey]);
      
      if (result.rows.length > 0) {
        this.lastProcessedBlock = Number(result.rows[0].last_block) || 0;
      } else {
        // Get current block and start from there
        this.lastProcessedBlock = await getCachedBlockNumber(this.config.rpcUrl, this.config.id);
        await query(`
          INSERT INTO indexer_state (chain_id, last_block, updated_at)
          VALUES ($1, $2, NOW())
          ON CONFLICT (chain_id) DO UPDATE SET last_block = $2, updated_at = NOW()
        `, [this.chainKey, this.lastProcessedBlock]);
      }
    } catch (error) {
      logger.error(`Failed to load last processed block for ${this.config.name}`, { error });
      this.lastProcessedBlock = await getCachedBlockNumber(this.config.rpcUrl, this.config.id);
    }
  }

  /** ERC-20 Transfer topic[2] values (padded `to` addresses) for getLogs filtering. */
  private watchedAddressTopics(): string[] {
    return [...this.watchedAddresses].map((a) => zeroPadValue(getAddress(a), 32));
  }

  /** Coalesce block processing to one in-flight call; keep only the newest pending block. */
  private async scheduleProcessBlock(blockNumber: number): Promise<void> {
    blockNumber = Number(blockNumber);
    if (!Number.isFinite(blockNumber) || blockNumber <= this.lastProcessedBlock) return;
    if (Date.now() < this.rateLimitedUntil) return;
    if (this.pendingBlock == null || blockNumber > this.pendingBlock) {
      this.pendingBlock = blockNumber;
    }
    if (this.blockProcessInFlight) return;
    this.blockProcessInFlight = true;
    try {
      while (this.pendingBlock != null && this.pendingBlock > this.lastProcessedBlock) {
        if (Date.now() < this.rateLimitedUntil) break;
        const target = this.pendingBlock;
        this.pendingBlock = null;
        // Process every block sequentially — never skip ranges (deposit safety).
        while (this.lastProcessedBlock < target) {
          const next = this.lastProcessedBlock + 1;
          const ok = await this.processBlockOnce(next);
          if (!ok) break;
        }
      }
    } finally {
      this.blockProcessInFlight = false;
      if (this.pendingBlock != null && this.pendingBlock > this.lastProcessedBlock) {
        void this.scheduleProcessBlock(this.pendingBlock);
      }
    }
  }

  private async processBlockOnce(blockNumber: number): Promise<boolean> {
    blockNumber = Number(blockNumber);
    if (!Number.isFinite(blockNumber) || blockNumber <= this.lastProcessedBlock) return true;
    if (Date.now() < this.rateLimitedUntil) return false;

    try {
      const block = await this.httpProvider.getBlock(blockNumber, true);
      if (!block) return false;

      logger.debug(`Processing block ${blockNumber} on ${this.config.name}`);

      await this.processNativeTransfers(block);
      const tokensOk = await this.processTokenTransfers(blockNumber, block.timestamp);
      if (!tokensOk) {
        logger.warn(`Token log processing failed for block ${blockNumber}; will retry`, {
          chain: this.config.name,
        });
        return false;
      }

      this.lastProcessedBlock = blockNumber;
      await this.updateLastProcessedBlock(blockNumber);
      return true;
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.rateLimitedUntil = Date.now() + ChainIndexer.RATE_LIMIT_BACKOFF_MS;
        logger.warn(`RPC rate-limited on ${this.config.name}; pausing block fetches for ${ChainIndexer.RATE_LIMIT_BACKOFF_MS / 1000}s`, {
          blockNumber,
        });
        return false;
      }
      logger.error(`Error processing block ${blockNumber} on ${this.config.name}`, { error });
      return false;
    }
  }

  /** When far behind chain head, scan ERC-20 transfers in chunks via getLogs (deposit-safe). */
  private async catchUpIfLagging(): Promise<void> {
    if (this.watchedAddresses.size === 0) return;
    try {
      const head = await getCachedBlockNumber(this.config.rpcUrl, this.config.id);
      const target = Math.max(0, head - this.config.confirmations);
      const lag = target - this.lastProcessedBlock;
      if (lag <= ChainIndexer.LAG_CATCHUP_THRESHOLD) return;

      logger.warn(`Indexer ${this.config.name} lagging ${lag} blocks — batch ERC-20 catch-up`, {
        from: this.lastProcessedBlock + 1,
        to: target,
      });

      const chunkEnv = parseInt(process.env.INDEXER_CATCHUP_CHUNK || '500', 10);
      const CHUNK = Math.min(Number.isFinite(chunkEnv) && chunkEnv > 0 ? chunkEnv : 500, 1500);
      let from = this.lastProcessedBlock + 1;
      while (from <= target && this.isRunning) {
        if (Date.now() < this.rateLimitedUntil) break;
        const to = Math.min(from + CHUNK - 1, target);
        const ok = await this.processTokenTransfersRange(from, to);
        if (!ok) break;
        // Advance through empty ranges; deposits are idempotent (ON CONFLICT DO NOTHING).
        this.lastProcessedBlock = to;
        await this.updateLastProcessedBlock(to);
        from = to + 1;
        await new Promise((r) => setTimeout(r, 250));
      }
      logger.info(`Indexer ${this.config.name} catch-up complete`, { lastBlock: this.lastProcessedBlock, target });
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.rateLimitedUntil = Date.now() + ChainIndexer.RATE_LIMIT_BACKOFF_MS;
      }
      logger.warn(`Catch-up failed for ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private async processTokenTransfersRange(fromBlock: number, toBlock: number): Promise<boolean> {
    if (this.watchedAddresses.size === 0) return true;
    try {
      const toTopics = this.watchedAddressTopics();
      if (toTopics.length === 0) return true;
      const logs = await this.httpProvider.getLogs({
        fromBlock,
        toBlock,
        topics: [ERC20_TRANSFER_TOPIC, null, toTopics.length === 1 ? toTopics[0]! : toTopics],
      });
      for (const log of logs) {
        const blockNumber = Number(log.blockNumber);
        const cachedTs = await getCachedBlockTimestamp(this.config.rpcUrl, blockNumber, this.config.id).catch(() => null);
        const blockTimestamp = cachedTs ?? Math.floor(Date.now() / 1000);
        await this.processTransferLog(log, blockNumber, blockTimestamp);
      }
      return true;
    } catch (error) {
      if (this.isRateLimitError(error)) throw error;
      if (this.isSkippableRpcError(error)) {
        logger.warn(`Token range scan skipped ${fromBlock}-${toBlock} on ${this.config.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        return true;
      }
      logger.warn(`Token range scan failed ${fromBlock}-${toBlock} on ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  private async processNativeTransfers(block: Block): Promise<void> {
    if (this.watchedAddresses.size === 0) return;
    if (!block.prefetchedTransactions) return;

    for (const tx of block.prefetchedTransactions) {
      if (!tx.to || !tx.value) continue;
      
      const toAddress = tx.to.toLowerCase();
      
      // Check if recipient is a watched address
      if (this.watchedAddresses.has(toAddress)) {
        const amount = ethers.formatUnits(tx.value, this.config.nativeDecimals);
        
        if (parseFloat(amount) > 0) {
          await this.recordDeposit({
            chainId: this.chainKey,
            txHash: tx.hash,
            fromAddress: tx.from.toLowerCase(),
            toAddress: toAddress,
            tokenAddress: null, // Native token
            symbol: this.config.symbol,
            amount: amount,
            decimals: this.config.nativeDecimals,
            blockNumber: block.number!,
            blockTimestamp: block.timestamp,
          });
        }
      }
    }
  }

  private async processTokenTransfers(blockNumber: number, blockTimestamp: number): Promise<boolean> {
    if (this.watchedAddresses.size === 0) return true;
    try {
      const toTopics = this.watchedAddressTopics();
      if (toTopics.length === 0) return true;

      // Topic-only filter: all ERC-20 transfers to watched addresses (known + unknown contracts).
      const logs = await this.httpProvider.getLogs({
        fromBlock: blockNumber,
        toBlock: blockNumber,
        topics: [
          ERC20_TRANSFER_TOPIC,
          null,
          toTopics.length === 1 ? toTopics[0]! : toTopics,
        ],
      });

      for (const log of logs) {
        await this.processTransferLog(log, blockNumber, blockTimestamp);
      }
      return true;
    } catch (error) {
      if (this.isRateLimitError(error)) throw error;
      if (this.isSkippableRpcError(error)) {
        logger.warn(`Skipping token transfers for block ${blockNumber} (RPC limit/archive)`, {
          chain: this.config.name,
        });
        return true;
      }
      logger.error(`Error processing token transfers for block ${blockNumber}`, { error });
      return false;
    }
  }

  private async processTransferLog(log: Log, blockNumber: number, blockTimestamp: number): Promise<void> {
    try {
      if (log.topics.length < 3) return;
      
      const tokenAddress = log.address.toLowerCase();
      const fromAddress = '0x' + log.topics[1].slice(26).toLowerCase();
      const toAddress = '0x' + log.topics[2].slice(26).toLowerCase();
      
      // Check if recipient is a watched address
      if (!this.watchedAddresses.has(toAddress)) return;
      
      // Resolve token metadata: DB first, then one-time on-chain fetch for unknown contracts.
      let tokenInfo = this.tokenContracts.get(tokenAddress) ?? this.fetchedTokenMetadata.get(tokenAddress);
      if (!tokenInfo) {
        const fetched = await this.fetchTokenMetadataOnce(tokenAddress);
        if (!fetched) {
          try {
            const raw = log.data && log.data !== '0x' ? ethers.formatUnits(log.data, 18) : '0';
            if (parseFloat(raw) > 0) {
              const userResult = await query(
                `SELECT w.user_id, w.id AS wallet_id, w.chain_id
                 FROM wallets w WHERE LOWER(w.address) = $1 AND w.chain_id = $2`,
                [toAddress, this.chainKey]
              );
              if (userResult.rows.length > 0) {
                const row = userResult.rows[0] as { user_id: string; wallet_id: string; chain_id: string };
                await this.queuePendingTokenDeposit({
                  userId: row.user_id,
                  walletId: row.wallet_id,
                  chainId: row.chain_id,
                  txHash: log.transactionHash,
                  fromAddress,
                  toAddress,
                  tokenAddress,
                  symbol: 'UNKNOWN',
                  amount: raw,
                  decimals: 18,
                  blockNumber,
                  blockTimestamp,
                });
              }
            }
          } catch (queueErr) {
            logger.error(`Failed to queue unknown-token deposit after metadata fetch failure`, {
              txHash: log.transactionHash,
              error: queueErr,
            });
          }
          return;
        }
        tokenInfo = fetched;
      }
      
      // Decode amount from log data
      const amount = ethers.formatUnits(log.data, tokenInfo.decimals);
      
      if (parseFloat(amount) > 0) {
        await this.recordDeposit({
          chainId: this.chainKey,
          txHash: log.transactionHash,
          fromAddress: fromAddress,
          toAddress: toAddress,
          tokenAddress: tokenAddress,
          symbol: tokenInfo.symbol,
          amount: amount,
          decimals: tokenInfo.decimals,
          blockNumber: blockNumber,
          blockTimestamp,
        });
      }
    } catch (error) {
      logger.error(`Error processing transfer log`, { log: log.transactionHash, error });
    }
  }

  private async fetchTokenMetadataOnce(
    tokenAddress: string
  ): Promise<{ symbol: string; decimals: number } | null> {
    const key = tokenAddress.toLowerCase();
    const cached = this.fetchedTokenMetadata.get(key);
    if (cached) return cached;

    try {
      const abi = [
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
      ];
      const contract = new ethers.Contract(tokenAddress, abi, this.httpProvider);
      const [symbol, decimals] = await Promise.all([contract.symbol(), contract.decimals()]);
      const info = { symbol: String(symbol), decimals: Number(decimals) };
      this.fetchedTokenMetadata.set(key, info);
      logger.info(`Fetched on-chain token metadata (once)`, { tokenAddress: key, symbol: info.symbol });
      return info;
    } catch (error) {
      logger.error(`Could not fetch token metadata for ${tokenAddress}`, { error });
      return null;
    }
  }

  private async queuePendingTokenDeposit(deposit: {
    userId: string;
    walletId: string;
    chainId: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    tokenAddress: string;
    symbol: string;
    amount: string;
    decimals: number;
    blockNumber: number;
    blockTimestamp: number;
  }): Promise<void> {
    try {
      const result = await query(
        `INSERT INTO indexer_pending_token_deposits (
          chain_id, tx_hash, token_address, from_address, to_address, amount,
          symbol, decimals, block_number, block_timestamp, user_id, wallet_id, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, to_timestamp($10), $11, $12, 'pending_review')
        ON CONFLICT (chain_id, tx_hash, to_address) DO NOTHING
        RETURNING id`,
        [
          deposit.chainId,
          deposit.txHash,
          deposit.tokenAddress.toLowerCase(),
          deposit.fromAddress,
          deposit.toAddress,
          deposit.amount,
          deposit.symbol,
          deposit.decimals,
          deposit.blockNumber,
          deposit.blockTimestamp,
          deposit.userId,
          deposit.walletId,
        ]
      );
      if (result.rows.length > 0) {
        logger.warn(`Deposit queued for token/currency review (not silently dropped)`, {
          chain: this.config.name,
          txHash: deposit.txHash,
          tokenAddress: deposit.tokenAddress,
          symbol: deposit.symbol,
          amount: deposit.amount,
          userId: deposit.userId,
        });
      }
    } catch (error) {
      logger.error(`Failed to queue pending token deposit`, { deposit, error });
    }
  }

  private async recordDeposit(deposit: {
    chainId: string;
    txHash: string;
    fromAddress: string;
    toAddress: string;
    tokenAddress: string | null;
    symbol: string;
    amount: string;
    decimals: number;
    blockNumber: number;
    blockTimestamp: number;
  }): Promise<void> {
    try {
      // Never record zero or negative amount (avoids duplicate/empty entries)
      if (!deposit.amount || parseFloat(deposit.amount) <= 0) {
        logger.debug(`Skipping zero/empty amount deposit: ${deposit.txHash}`);
        return;
      }

      // Skip zero-value deposits (e.g. contract calls that emit 0 transfer)
      if (!deposit.amount || parseFloat(deposit.amount) <= 0) {
        logger.debug(`Skipping zero-value deposit: ${deposit.txHash}`);
        return;
      }

      const userResult = await query(`
        SELECT w.user_id, w.id as wallet_id, w.chain_id
        FROM wallets w
        WHERE LOWER(w.address) = $1 AND w.chain_id = $2
      `, [deposit.toAddress, this.chainKey]);
      
      if (userResult.rows.length === 0) {
        logger.warn(`No user found for address ${deposit.toAddress} on ${deposit.chainId}`);
        return;
      }
      
      const userId = userResult.rows[0].user_id;
      const walletId = userResult.rows[0].wallet_id;
      const chainId = userResult.rows[0].chain_id;

      // Get currency ID
      let currencyId: string | null = null;
      
      if (deposit.tokenAddress) {
        // ERC20 token - find by contract address
        const tokenResult = await query(`
          SELECT id FROM currencies WHERE LOWER(contract_address) = $1 LIMIT 1
        `, [deposit.tokenAddress.toLowerCase()]);
        
        if (tokenResult.rows.length > 0) {
          currencyId = tokenResult.rows[0].id;
        }
      }
      
      // If no currency found by contract, find by symbol
      if (!currencyId) {
        const symbolResult = await query(`
          SELECT id FROM currencies WHERE UPPER(symbol) = $1 LIMIT 1
        `, [deposit.symbol.toUpperCase()]);
        
        if (symbolResult.rows.length > 0) {
          currencyId = symbolResult.rows[0].id;
        }
      }

      if (!currencyId) {
        await this.queuePendingTokenDeposit({
          userId,
          walletId,
          chainId,
          txHash: deposit.txHash,
          fromAddress: deposit.fromAddress,
          toAddress: deposit.toAddress,
          tokenAddress: deposit.tokenAddress!,
          symbol: deposit.symbol,
          amount: deposit.amount,
          decimals: deposit.decimals,
          blockNumber: deposit.blockNumber,
          blockTimestamp: deposit.blockTimestamp,
        });
        return;
      }

      const insertResult = await query(`
        INSERT INTO deposits (
          id, user_id, currency_id, chain_id, wallet_id, tx_hash, 
          from_address, to_address, amount, fee, confirmations, 
          required_confirmations, block_number, block_timestamp, 
          status, created_at, updated_at
        ) VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, 0, 0, $9, $10, 
          to_timestamp($11), 'pending', NOW(), NOW()
        )
        ON CONFLICT (chain_id, tx_hash, to_address) DO NOTHING
        RETURNING id
      `, [
        userId,
        currencyId,
        chainId,
        walletId,
        deposit.txHash,
        deposit.fromAddress,
        deposit.toAddress,
        deposit.amount,
        this.config.confirmations,
        deposit.blockNumber,
        deposit.blockTimestamp,
      ]);

      if (insertResult.rows.length === 0) {
        logger.debug(`Deposit already recorded (duplicate tx), skipping: ${deposit.txHash}`);
        return;
      }

      logger.info(`Recorded deposit`, {
        chain: this.config.name,
        txHash: deposit.txHash,
        symbol: deposit.symbol,
        amount: deposit.amount,
        user: userId,
      });

      // Update user pending balance
      await this.updatePendingBalance(userId, currencyId, deposit.amount);

      // Send email notification for deposit detected
      const explorerMap: Record<string, string> = {
        'ethereum': 'https://etherscan.io/tx/',
        'bsc': 'https://bscscan.com/tx/',
        'polygon': 'https://polygonscan.com/tx/',
        'arbitrum': 'https://arbiscan.io/tx/',
        'base': 'https://basescan.org/tx/',
      };
      const explorerUrl = explorerMap[this.chainKey] ? `${explorerMap[this.chainKey]}${deposit.txHash}` : undefined;

      emailService.sendDepositDetectedEmail(userId, {
        symbol: deposit.symbol,
        amount: deposit.amount,
        chainName: this.config.name,
        txHash: deposit.txHash,
        requiredConfirmations: this.config.confirmations,
        explorerUrl,
      });
    } catch (error) {
      logger.error(`Failed to record deposit`, { deposit, error });
    }
  }

  private async updatePendingBalance(userId: string, currencyId: string, amount: string): Promise<void> {
    try {
      const exists = await query(`SELECT 1 FROM currencies WHERE id = $1`, [currencyId]);
      if (exists.rows.length === 0) {
        logger.warn(`Currency ${currencyId} not in currencies, skipping pending balance update`);
        return;
      }
      const CHAIN_ID_GLOBAL = '';
      await query(`
        INSERT INTO user_balances (id, user_id, currency_id, chain_id, available_balance, pending_balance, account_type, updated_at)
        VALUES (gen_random_uuid(), $1, $2, $3, 0, $4, 'funding', NOW())
        ON CONFLICT (user_id, currency_id, chain_id, account_type)
        DO UPDATE SET pending_balance = user_balances.pending_balance + $4, updated_at = NOW()
      `, [userId, currencyId, CHAIN_ID_GLOBAL, amount]);
    } catch (error) {
      logger.error(`Failed to update pending balance`, { userId, currencyId, amount, error });
    }
  }

  private async updateLastProcessedBlock(blockNumber: number): Promise<void> {
    try {
      await query(`
        UPDATE indexer_state SET last_block = $1, updated_at = NOW() WHERE chain_id = $2
      `, [blockNumber, this.chainKey]);
    } catch (error) {
      logger.error(`Failed to update last processed block`, { blockNumber, error });
    }
  }

  // Add a new address to watch
  async addWatchedAddress(address: string): Promise<void> {
    this.watchedAddresses.add(address.toLowerCase());
    logger.info(`Added watched address for ${this.config.name}`, { address });
  }

  // Remove an address from watch list
  removeWatchedAddress(address: string): void {
    this.watchedAddresses.delete(address.toLowerCase());
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    this.wsDisabled = true;
    this.clearReconnectTimer();

    if (this.watchReloadTimer) {
      clearInterval(this.watchReloadTimer);
      this.watchReloadTimer = null;
    }

    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }

    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
      await this.wsProvider.destroy();
      this.wsProvider = null;
    }

    logger.info(`Indexer stopped for ${this.config.name}`);
  }

  /** Periodically merge new wallet addresses and tokens from DB (no restart required). */
  private startWatchlistReload(): void {
    if (this.watchReloadTimer) return;
    this.watchReloadTimer = setInterval(() => {
      if (!this.isRunning) return;
      void this.loadWatchedAddresses();
      void this.loadTokenContracts();
    }, ChainIndexer.WATCH_RELOAD_MS);
  }

  /**
   * HTTP polling fallback. Keeps indexer_state.updated_at fresh even when WebSocket
   * is blocked (e.g. Ankr free tier returns 404 on WS), and processes any new blocks.
   * Uses `safe_block - confirmations` to avoid refetching shallow reorgs.
   */
  private startHttpPolling(): void {
    if (this.pollTimer) return;
    const tick = async () => {
      if (!this.isRunning) return;
      if (Date.now() < this.rateLimitedUntil) return;
      try {
        // Heartbeat only — do not advance last_block to chain head without processing.
        await query(
          `INSERT INTO indexer_state (chain_id, last_block, updated_at)
           VALUES ($1, $2, NOW())
           ON CONFLICT (chain_id) DO UPDATE SET
             last_block = GREATEST(indexer_state.last_block, EXCLUDED.last_block),
             updated_at = NOW()`,
          [this.chainKey, this.lastProcessedBlock]
        );

        // When WS is healthy it owns live blocks; HTTP poll avoids duplicate RPC load.
        // Still batch catch-up when far behind — WS only delivers new heads, not historical gap.
        const head = await getCachedBlockNumber(this.config.rpcUrl, this.config.id);
        const target = Math.max(0, head - this.config.confirmations);
        const lag = target - this.lastProcessedBlock;
        if (lag > ChainIndexer.LAG_CATCHUP_THRESHOLD) {
          await this.catchUpIfLagging();
        }
        if (this.isWsHealthy()) return;

        const maxPerTick =
          lag > ChainIndexer.LAG_CATCHUP_THRESHOLD
            ? ChainIndexer.MAX_BLOCKS_PER_HTTP_TICK_CATCHUP
            : ChainIndexer.MAX_BLOCKS_PER_HTTP_TICK;

        let processed = 0;
        while (this.lastProcessedBlock < target && processed < maxPerTick) {
          const ok = await this.processBlockOnce(this.lastProcessedBlock + 1);
          if (!ok) break;
          processed += 1;
        }
      } catch (error) {
        if (this.isRateLimitError(error)) {
          this.rateLimitedUntil = Date.now() + ChainIndexer.RATE_LIMIT_BACKOFF_MS;
        }
        logger.debug(`HTTP poll tick failed for ${this.config.name}`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };
    // Fire once immediately so heartbeat updates on startup, then on interval.
    tick().catch(() => { /* logged inside */ });
    this.pollTimer = setInterval(tick, this.pollIntervalMs);
  }

  /** Scan chain head for ERC-20 deposits — works even when sequential indexer is far behind. */
  async scanRecentDeposits(windowBlocks?: number): Promise<number> {
    const win = windowBlocks ?? ChainIndexer.recentScanWindowBlocks();
    return this.scanRecentDepositsForAddresses([...this.watchedAddresses], win);
  }

  static recentScanWindowBlocks(): number {
    const n = parseInt(process.env.INDEXER_RECENT_SCAN_BLOCKS || '2000', 10);
    return Number.isFinite(n) && n > 0 ? Math.min(n, 9000) : 2000;
  }

  async scanRecentDepositsForAddresses(addresses: string[], windowBlocks?: number): Promise<number> {
    const win = windowBlocks ?? ChainIndexer.recentScanWindowBlocks();
    if (!this.isRunning || addresses.length === 0) return 0;
    if (Date.now() < this.rateLimitedUntil) return 0;

    const addressSet = new Set(addresses.map((a) => a.toLowerCase()));
    const toTopics = [...addressSet].map((a) => zeroPadValue(getAddress(a), 32));
    if (toTopics.length === 0) return 0;

    let processed = 0;
    try {
      const head = await getCachedBlockNumber(this.config.rpcUrl, this.config.id);
      const from = Math.max(1, head - win);
      const to = head;
      // The block poller already reads this window when the chain is caught up.
      if (head - this.lastProcessedBlock <= win + this.config.confirmations) return 0;

      const logs = await this.httpProvider.getLogs({
        fromBlock: from,
        toBlock: to,
        topics: [ERC20_TRANSFER_TOPIC, null, toTopics.length === 1 ? toTopics[0]! : toTopics],
      });
      for (const log of logs) {
        await this.ingestLogFromScan(log, addressSet);
        processed += 1;
      }

      if (processed > 0) {
        logger.info(`Recent deposit scan on ${this.config.name}`, { processed, from, to });
      }
    } catch (error) {
      if (this.isRateLimitError(error)) {
        this.rateLimitedUntil = Date.now() + ChainIndexer.RATE_LIMIT_BACKOFF_MS;
      }
      logger.warn(`Recent deposit scan failed on ${this.config.name}`, {
        error: error instanceof Error ? error.message : String(error),
      });
    }
    return processed;
  }

  private async ingestLogFromScan(log: Log, allowedRecipients: Set<string>): Promise<void> {
    if (log.topics.length < 3) return;
    const toAddress = ('0x' + log.topics[2].slice(26)).toLowerCase();
    if (!allowedRecipients.has(toAddress)) return;
    const blockNumber = Number(log.blockNumber);
    const cachedTs = await getCachedBlockTimestamp(this.config.rpcUrl, blockNumber, this.config.id).catch(() => null);
    const blockTimestamp = cachedTs ?? Math.floor(Date.now() / 1000);
    await this.processTransferLog(log, blockNumber, blockTimestamp);
  }

  getStats(): object {
    return {
      chain: this.config.name,
      chainId: this.config.id,
      isRunning: this.isRunning,
      watchedAddresses: this.watchedAddresses.size,
      tokenContracts: this.tokenContracts.size,
      lastProcessedBlock: this.lastProcessedBlock,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}
