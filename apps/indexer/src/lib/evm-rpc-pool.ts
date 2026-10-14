/**
 * Indexer-side singleton EVM RPC pool with short-lived block-number cache and request coalescing.
 */
import { JsonRpcProvider } from 'ethers';

const providers = new Map<string, JsonRpcProvider>();
const blockCache = new Map<string, { n: number; at: number }>();
const BLOCK_CACHE_MS = parseInt(process.env.INDEXER_BLOCK_CACHE_MS || '10000', 10);
const receiptCache = new Map<string, { status: number | null; at: number }>();
const RECEIPT_CACHE_MS = 86_400_000;
const inflight = new Map<string, Promise<unknown>>();

async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

export function getEvmRpcProvider(rpcUrl: string, chainId?: number): JsonRpcProvider {
  const url = rpcUrl.trim();
  const key = chainId != null ? `${url}#${chainId}` : url;
  let provider = providers.get(key);
  if (!provider) {
    provider =
      chainId != null
        ? new JsonRpcProvider(url, chainId, { staticNetwork: true })
        : new JsonRpcProvider(url);
    providers.set(key, provider);
  }
  return provider;
}

const blockTimestampCache = new Map<string, number>();

/** One eth_getBlockByNumber per block, shared by every log in that block. */
export async function getCachedBlockTimestamp(
  rpcUrl: string,
  blockNumber: number,
  chainId?: number
): Promise<number | null> {
  const key = `${rpcUrl}#${chainId ?? 0}#${blockNumber}`;
  return coalesce(`blkts:${key}`, async () => {
    const hit = blockTimestampCache.get(key);
    if (hit != null) return hit;
    const block = await getEvmRpcProvider(rpcUrl, chainId).getBlock(blockNumber);
    const ts = block?.timestamp ?? null;
    if (ts != null) blockTimestampCache.set(key, ts);
    return ts;
  });
}

export async function getCachedBlockNumber(rpcUrl: string, chainId?: number): Promise<number> {
  const key = `${rpcUrl}#${chainId ?? 0}`;
  return coalesce(`block:${key}`, async () => {
    const hit = blockCache.get(key);
    if (hit && Date.now() - hit.at < BLOCK_CACHE_MS) return hit.n;
    const n = await getEvmRpcProvider(rpcUrl, chainId).getBlockNumber();
    blockCache.set(key, { n, at: Date.now() });
    return n;
  });
}

export async function getCachedTxReceiptStatus(
  rpcUrl: string,
  txHash: string,
  chainId?: number
): Promise<number | null> {
  const cacheKey = `${rpcUrl}:${txHash.toLowerCase()}`;
  return coalesce(`receipt:${cacheKey}`, async () => {
    const hit = receiptCache.get(cacheKey);
    if (hit && Date.now() - hit.at < RECEIPT_CACHE_MS) return hit.status;
    const receipt = await getEvmRpcProvider(rpcUrl, chainId).getTransactionReceipt(txHash);
    const status = receipt?.status ?? null;
    if (status != null) receiptCache.set(cacheKey, { status, at: Date.now() });
    return status;
  });
}
