/**
 * Singleton EVM JSON-RPC pool with Redis-backed caching, request coalescing,
 * Multicall3 batch reads, and RPC budget accounting.
 */
import { Contract, JsonRpcProvider, keccak256, toUtf8Bytes } from 'ethers';
import { redis } from './redis.js';
import { logger } from './logger.js';
import { recordRpcOutbound, recordRpc429, type RpcBudgetCategory } from './rpc-budget-manager.js';

export type EvmRpcCategory = RpcBudgetCategory;

const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';
const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
] as const;
const ERC20_BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'] as const;

const providers = new Map<string, JsonRpcProvider>();
const inflight = new Map<string, Promise<unknown>>();

function rpcCacheKey(kind: string, rpcUrl: string, suffix: string): string {
  const urlHash = keccak256(toUtf8Bytes(rpcUrl.trim())).slice(2, 18);
  return `rpc:cache:${kind}:${urlHash}:${suffix}`;
}

function isRateLimitError(error: unknown): boolean {
  const blob = JSON.stringify(error);
  return /429|rate limit|compute units|too many requests/i.test(blob);
}

async function coalesce<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;
  const p = fn().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, p);
  return p;
}

/** Reuse one JsonRpcProvider per RPC URL (staticNetwork when chainId known). */
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

export async function getCachedBlockNumber(
  rpcUrl: string,
  chainId?: number,
  ttlSec = 10,
  category: RpcBudgetCategory = 'other'
): Promise<number> {
  const cacheKey = rpcCacheKey('block', rpcUrl, 'latest');
  return coalesce(`block:${cacheKey}`, async () => {
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null && cached !== '') return Number(cached);
    } catch {
      /* redis optional */
    }
    await recordRpcOutbound(category);
    try {
      const n = await getEvmRpcProvider(rpcUrl, chainId).getBlockNumber();
      try {
        await redis.set(cacheKey, String(n), ttlSec);
      } catch {
        /* best-effort */
      }
      return n;
    } catch (e) {
      if (isRateLimitError(e)) await recordRpc429();
      throw e;
    }
  });
}

export async function getCachedNativeBalance(
  rpcUrl: string,
  address: string,
  chainId?: number,
  ttlSec = 60,
  category: RpcBudgetCategory = 'other'
): Promise<bigint> {
  const addr = address.toLowerCase();
  const cacheKey = rpcCacheKey('native', rpcUrl, addr);
  return coalesce(`bal:${cacheKey}`, async () => {
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null && cached !== '') return BigInt(cached);
    } catch {
      /* redis optional */
    }
    await recordRpcOutbound(category);
    try {
      const bal = await getEvmRpcProvider(rpcUrl, chainId).getBalance(address);
      try {
        await redis.set(cacheKey, bal.toString(), ttlSec);
      } catch {
        /* best-effort */
      }
      return bal;
    } catch (e) {
      if (isRateLimitError(e)) await recordRpc429();
      throw e;
    }
  });
}

export async function getCachedTxReceipt(
  rpcUrl: string,
  txHash: string,
  chainId?: number,
  ttlSec = 86_400,
  category: RpcBudgetCategory = 'deposit_confirm'
): Promise<{ status: number | null; blockNumber: number | null } | null> {
  const hash = txHash.toLowerCase();
  const cacheKey = rpcCacheKey('receipt', rpcUrl, hash);
  return coalesce(`rcpt:${cacheKey}`, async () => {
    try {
      const cached = await redis.get(cacheKey);
      if (cached != null && cached !== '') {
        return JSON.parse(cached) as { status: number | null; blockNumber: number | null };
      }
    } catch {
      /* redis optional */
    }
    await recordRpcOutbound(category);
    try {
      const receipt = await getEvmRpcProvider(rpcUrl, chainId).getTransactionReceipt(txHash);
      if (!receipt) return null;
      const payload = { status: receipt.status ?? null, blockNumber: receipt.blockNumber ?? null };
      try {
        await redis.set(cacheKey, JSON.stringify(payload), ttlSec);
      } catch {
        /* best-effort */
      }
      return payload;
    } catch (e) {
      if (isRateLimitError(e)) await recordRpc429();
      throw e;
    }
  });
}

export async function getCachedFeeData(
  rpcUrl: string,
  chainId?: number,
  ttlSec = 15,
  category: RpcBudgetCategory = 'other'
): Promise<{
  gasPrice: bigint | null;
  maxFeePerGas: bigint | null;
  maxPriorityFeePerGas: bigint | null;
}> {
  const cacheKey = rpcCacheKey('fee', rpcUrl, 'latest');
  return coalesce(`fee:${cacheKey}`, async () => {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const p = JSON.parse(cached) as {
          gasPrice: string | null;
          maxFeePerGas: string | null;
          maxPriorityFeePerGas: string | null;
        };
        return {
          gasPrice: p.gasPrice != null ? BigInt(p.gasPrice) : null,
          maxFeePerGas: p.maxFeePerGas != null ? BigInt(p.maxFeePerGas) : null,
          maxPriorityFeePerGas: p.maxPriorityFeePerGas != null ? BigInt(p.maxPriorityFeePerGas) : null,
        };
      }
    } catch {
      /* redis optional */
    }
    await recordRpcOutbound(category);
    try {
      const fee = await getEvmRpcProvider(rpcUrl, chainId).getFeeData();
      const payload = {
        gasPrice: fee.gasPrice?.toString() ?? null,
        maxFeePerGas: fee.maxFeePerGas?.toString() ?? null,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas?.toString() ?? null,
      };
      try {
        await redis.set(cacheKey, JSON.stringify(payload), ttlSec);
      } catch {
        /* best-effort */
      }
      return {
        gasPrice: fee.gasPrice,
        maxFeePerGas: fee.maxFeePerGas,
        maxPriorityFeePerGas: fee.maxPriorityFeePerGas,
      };
    } catch (e) {
      if (isRateLimitError(e)) await recordRpc429();
      throw e;
    }
  });
}

/** Batch ERC-20 balanceOf via Multicall3 — one eth_call per chain (+ one getBalance if native needed). */
export async function batchEvmBalances(
  rpcUrl: string,
  holderAddress: string,
  tokens: Array<{ contractAddress: string | null; isNative: boolean }>,
  chainId?: number,
  category: RpcBudgetCategory = 'other'
): Promise<string[]> {
  if (tokens.length === 0) return [];
  const provider = getEvmRpcProvider(rpcUrl, chainId);
  const iface = new Contract(MULTICALL3, ERC20_BALANCE_ABI, provider).interface;

  const needsNative = tokens.some((t) => t.isNative || !t.contractAddress);
  let nativeBal = 0n;
  if (needsNative) {
    try {
      nativeBal = await getCachedNativeBalance(rpcUrl, holderAddress, chainId, 60, category);
    } catch {
      nativeBal = 0n;
    }
  }

  const erc20Tokens = tokens
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => !t.isNative && !!t.contractAddress);

  const out: string[] = tokens.map((t) =>
    t.isNative || !t.contractAddress ? nativeBal.toString() : '0'
  );

  if (erc20Tokens.length === 0) return out;

  const calls = erc20Tokens.map(({ t }) => ({
    target: t.contractAddress!,
    allowFailure: true,
    callData: iface.encodeFunctionData('balanceOf', [holderAddress]),
  }));

  try {
    await recordRpcOutbound(category);
    const mc = new Contract(MULTICALL3, MULTICALL3_ABI, provider);
    const fn = mc.getFunction('aggregate3');
    if (!fn) throw new Error('multicall unavailable');
    const results = (await fn(calls)) as Array<{ success: boolean; returnData: string }>;
    erc20Tokens.forEach(({ i }, idx) => {
      const r = results[idx]!;
      if (!r?.success || !r.returnData || r.returnData === '0x') return;
      try {
        const decoded = iface.decodeFunctionResult('balanceOf', r.returnData);
        out[i] = String(decoded[0] ?? 0n);
      } catch {
        /* keep 0 */
      }
    });
  } catch (e) {
    if (isRateLimitError(e)) await recordRpc429();
    logger.warn('batchEvmBalances multicall failed, falling back to sequential', {
      error: e instanceof Error ? e.message : String(e),
    });
    for (const { t, i } of erc20Tokens) {
      try {
        await recordRpcOutbound(category);
        const c = new Contract(t.contractAddress!, ERC20_BALANCE_ABI, provider);
        const balFn = c.getFunction('balanceOf');
        out[i] = balFn ? String(await balFn(holderAddress)) : '0';
      } catch {
        out[i] = '0';
      }
    }
  }
  return out;
}

/** Multicall balanceOf for many contracts — returns map keyed by lowercase contract address. */
export async function batchErc20BalancesForHolder(
  rpcUrl: string,
  holderAddress: string,
  contractAddresses: string[],
  chainId?: number,
  category: RpcBudgetCategory = 'treasury_reconcile'
): Promise<Map<string, bigint>> {
  const out = new Map<string, bigint>();
  if (contractAddresses.length === 0) return out;
  const tokens = contractAddresses.map((c) => ({ contractAddress: c, isNative: false }));
  const balances = await batchEvmBalances(rpcUrl, holderAddress, tokens, chainId, category);
  contractAddresses.forEach((addr, i) => {
    try {
      out.set(addr.toLowerCase(), BigInt(balances[i] ?? '0'));
    } catch {
      out.set(addr.toLowerCase(), 0n);
    }
  });
  return out;
}

/** Invalidate cached native balance after a sweep / withdrawal updates on-chain state. */
export async function invalidateNativeBalanceCache(rpcUrl: string, address: string): Promise<void> {
  try {
    await redis.del(rpcCacheKey('native', rpcUrl, address.toLowerCase()));
  } catch {
    /* best-effort */
  }
}
