/**
 * Blockchain State Service — single source of truth for cached on-chain reads (backend).
 * All non-indexer consumers should prefer this over direct evm-rpc-pool calls.
 *
 * Does NOT alter deposit/withdrawal/settlement logic — only deduplicates and caches reads.
 */
import { db } from './database.js';
import {
  batchEvmBalances,
  batchErc20BalancesForHolder,
  getCachedBlockNumber,
  getCachedFeeData,
  getCachedNativeBalance,
  getCachedTxReceipt,
  getEvmRpcProvider,
  invalidateNativeBalanceCache,
} from './evm-rpc-pool.js';
import { isNonCriticalRpcPaused, recordRpc429, type RpcBudgetCategory } from './rpc-budget-manager.js';

/** Unified TTL for hot-wallet native balance — shared across treasury, recon, sweep. */
export const AUTHORITATIVE_NATIVE_BALANCE_TTL_SEC = 60;

type ChainRpcRow = { id: string; rpc_url: string; type: string };

const chainRpcCache = new Map<string, { row: ChainRpcRow; at: number }>();
const CHAIN_RPC_CACHE_MS = 60_000;

async function chainRpc(chainId: string): Promise<ChainRpcRow | null> {
  const hit = chainRpcCache.get(chainId);
  if (hit && Date.now() - hit.at < CHAIN_RPC_CACHE_MS) return hit.row;
  const res = await db.query<ChainRpcRow>(
    `SELECT id, rpc_url, type FROM chains WHERE id = $1 AND is_active = TRUE`,
    [chainId]
  );
  if (res.rows.length === 0) return null;
  const row = res.rows[0]!;
  chainRpcCache.set(chainId, { row, at: Date.now() });
  return row;
}

export async function getLatestBlockNumber(
  chainId: string,
  numericChainId?: number,
  category: RpcBudgetCategory = 'other'
): Promise<number | null> {
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return null;
  return getCachedBlockNumber(chain.rpc_url, numericChainId, 5, category);
}

export async function getHotWalletNativeBalanceWei(
  chainId: string,
  address: string,
  options?: { forceRefresh?: boolean; category?: RpcBudgetCategory }
): Promise<bigint | null> {
  const category = options?.category ?? 'other';
  if (!options?.forceRefresh && !(await isCriticalCategory(category))) {
    if (await isNonCriticalRpcPaused()) return null;
  }
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return null;
  if (options?.forceRefresh) {
    await invalidateNativeBalanceCache(chain.rpc_url, address);
  }
  try {
    return await getCachedNativeBalance(
      chain.rpc_url,
      address,
      undefined,
      AUTHORITATIVE_NATIVE_BALANCE_TTL_SEC,
      category
    );
  } catch {
    return null;
  }
}

export async function getHotWalletNativeBalanceByChainId(
  chainId: string,
  options?: { forceRefresh?: boolean; category?: RpcBudgetCategory }
): Promise<{ balanceWei: string } | null> {
  const wallet = await db.query<{ address: string }>(
    `SELECT address FROM hot_wallets WHERE chain_id = $1 AND is_active = TRUE`,
    [chainId]
  );
  if (wallet.rows.length === 0) return null;
  const bal = await getHotWalletNativeBalanceWei(chainId, wallet.rows[0]!.address, options);
  if (bal == null) return null;
  return { balanceWei: bal.toString() };
}

export async function getTransactionReceiptCached(
  chainId: string,
  txHash: string,
  numericChainId?: number,
  category: RpcBudgetCategory = 'deposit_confirm'
): Promise<{ status: number | null; blockNumber: number | null } | null> {
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return null;
  return getCachedTxReceipt(chain.rpc_url, txHash, numericChainId, 86_400, category);
}

export async function getFeeDataCached(
  chainId: string,
  numericChainId?: number
): Promise<Awaited<ReturnType<typeof getCachedFeeData>> | null> {
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return null;
  return getCachedFeeData(chain.rpc_url, numericChainId, 15, 'other');
}

export async function getTokenBalancesForHolder(
  chainId: string,
  holderAddress: string,
  tokens: Array<{ contractAddress: string | null; isNative: boolean }>,
  category: RpcBudgetCategory = 'treasury_reconcile'
): Promise<string[] | null> {
  if (await isNonCriticalRpcPaused()) return null;
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return null;
  return batchEvmBalances(chain.rpc_url, holderAddress, tokens, undefined, category);
}

export async function getErc20BalancesBatch(
  chainId: string,
  holderAddress: string,
  contractAddresses: string[],
  category: RpcBudgetCategory = 'treasury_reconcile'
): Promise<Map<string, bigint>> {
  if (await isNonCriticalRpcPaused()) return new Map();
  const chain = await chainRpc(chainId);
  if (!chain || chain.type !== 'evm') return new Map();
  return batchErc20BalancesForHolder(chain.rpc_url, holderAddress, contractAddresses, undefined, category);
}

export function getWriteProvider(chainId: string, rpcUrl: string) {
  return getEvmRpcProvider(rpcUrl);
}

export async function resolveChainRpcUrl(chainId: string): Promise<string | null> {
  const chain = await chainRpc(chainId);
  return chain?.rpc_url ?? null;
}

export async function onRpcRateLimited(): Promise<void> {
  await recordRpc429();
}

async function isCriticalCategory(category: RpcBudgetCategory): Promise<boolean> {
  return category === 'deposit_indexer' || category === 'deposit_confirm' || category === 'withdrawal';
}

export { invalidateNativeBalanceCache };
