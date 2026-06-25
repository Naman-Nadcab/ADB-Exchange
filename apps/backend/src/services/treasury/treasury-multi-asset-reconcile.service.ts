/**
 * Per-token (ERC-20) hot wallet balance vs cached row; Multicall batch + quorum when secondary RPC configured.
 */
import { db } from '../../lib/database.js';
import { logger, securityLog } from '../../lib/logger.js';
import { treasuryTokenMismatchTotal } from '../../lib/prometheus-metrics.js';
import { batchErc20BalancesForHolder } from '../../lib/evm-rpc-pool.js';
import { isNonCriticalRpcPaused } from '../../lib/rpc-budget-manager.js';
import { sendOpsAlert } from '../ops-alert.service.js';
import { logTreasuryAudit } from './treasury-audit.service.js';

const TOLERANCE_UNITS = 1n; // 1 base unit slack

function tallyMajority(bals: bigint[], minAgree: number): bigint {
  const counts = new Map<string, { bal: bigint; n: number }>();
  for (const b of bals) {
    const k = b.toString();
    const cur = counts.get(k);
    if (cur) cur.n++;
    else counts.set(k, { bal: b, n: 1 });
  }
  let best: { bal: bigint; n: number } | null = null;
  for (const v of counts.values()) {
    if (!best || v.n > best.n) best = v;
  }
  if (!best || best.n < minAgree) {
    throw new Error(`EVM_QUORUM_MISMATCH: need ${minAgree} agreeing reads`);
  }
  return best.bal;
}

type ReconcileRow = {
  hot_wallet_id: string;
  chain_id: string;
  address: string;
  rpc_url: string;
  rpc_secondary: string | null;
  token_id: string;
  symbol: string;
  contract_address: string;
  decimals: number;
  balance_raw: string | null;
};

async function onchainBalanceQuorum(
  contractAddress: string,
  rpcUrls: string[],
  minAgree: number,
  batchCache: Map<string, Map<string, bigint>>
): Promise<bigint> {
  const contractKey = contractAddress.toLowerCase();
  const bals: bigint[] = [];
  for (const url of rpcUrls) {
    const batch = batchCache.get(url);
    if (!batch?.has(contractKey)) continue;
    bals.push(batch.get(contractKey)!);
  }
  if (bals.length < minAgree) {
    throw new Error(`EVM_QUORUM_INSUFFICIENT_RPC: ${bals.length}/${rpcUrls.length}`);
  }
  return tallyMajority(bals, minAgree);
}

export async function runTreasuryTokenReconcileOnce(): Promise<{ checked: number; mismatches: number }> {
  if (await isNonCriticalRpcPaused()) return { checked: 0, mismatches: 0 };
  const rows = await db.query<{
    hot_wallet_id: string;
    chain_id: string;
    address: string;
    rpc_url: string;
    rpc_secondary: string | null;
    token_id: string;
    symbol: string;
    contract_address: string;
    decimals: number;
    balance_raw: string | null;
  }>(
    `SELECT hw.id AS hot_wallet_id, hw.chain_id, hw.address,
            COALESCE(c.rpc_url, '') AS rpc_url,
            NULLIF(TRIM(COALESCE(c.rpc_url_secondary, '')), '') AS rpc_secondary,
            t.id AS token_id, t.symbol, t.contract_address, t.decimals,
            htb.balance_raw::text AS balance_raw
     FROM hot_wallets hw
     JOIN chains c ON c.id = hw.chain_id AND c.type = 'evm'
     JOIN tokens t ON t.chain_id = hw.chain_id AND t.is_active = TRUE AND t.is_native = FALSE
       AND t.contract_address IS NOT NULL AND TRIM(t.contract_address) <> ''
     LEFT JOIN hot_wallet_token_balances htb ON htb.hot_wallet_id = hw.id AND htb.token_id = t.id
     WHERE hw.is_active = TRUE AND COALESCE(c.rpc_url, '') <> ''`
  );

  let mismatches = 0;

  const byWallet = new Map<string, ReconcileRow[]>();
  for (const row of rows.rows) {
    const list = byWallet.get(row.hot_wallet_id) ?? [];
    list.push(row);
    byWallet.set(row.hot_wallet_id, list);
  }

  for (const walletRows of byWallet.values()) {
    const first = walletRows[0]!;
    const rpcUrls = [first.rpc_url, first.rpc_secondary ?? ''].map((u) => u.trim()).filter(Boolean);
    if (rpcUrls.length === 0) continue;
    const minAgree = rpcUrls.length >= 2 ? 2 : 1;
    const contracts = [...new Set(walletRows.map((r) => r.contract_address))];
    const batchCache = new Map<string, Map<string, bigint>>();

    for (const url of rpcUrls) {
      try {
        const batch = await batchErc20BalancesForHolder(url, first.address, contracts, undefined, 'treasury_reconcile');
        batchCache.set(url, batch);
      } catch (e) {
        logger.warn('treasury_token_reconcile: batch rpc failed', {
          chain_id: first.chain_id,
          url: url.slice(0, 40),
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    for (const row of walletRows) {
      try {
        const onchain = await onchainBalanceQuorum(row.contract_address, rpcUrls, minAgree, batchCache);
      const cached = row.balance_raw != null && row.balance_raw !== '' ? BigInt(row.balance_raw.split('.')[0] || '0') : null;

      if (cached === null) {
        await db.query(
          `INSERT INTO hot_wallet_token_balances (hot_wallet_id, token_id, balance_raw, updated_at)
           VALUES ($1::uuid, $2::uuid, $3::numeric, NOW())
           ON CONFLICT (hot_wallet_id, token_id) DO UPDATE SET balance_raw = EXCLUDED.balance_raw, updated_at = NOW()`,
          [row.hot_wallet_id, row.token_id, onchain.toString()]
        );
        continue;
      }

      const diff = onchain > cached ? onchain - cached : cached - onchain;
      if (diff > TOLERANCE_UNITS) {
        mismatches++;
        treasuryTokenMismatchTotal.inc({ chain_id: row.chain_id, symbol: row.symbol });
        securityLog('treasury_token_onchain_mismatch', 'critical', {
          chain_id: row.chain_id,
          symbol: row.symbol,
          token_id: row.token_id,
          address: row.address,
          onchain: onchain.toString(),
          cached: cached.toString(),
        });
        void sendOpsAlert({
          severity: 'critical',
          alertType: 'treasury',
          title: 'Treasury token reconcile mismatch',
          body: `${row.symbol} on ${row.chain_id}: on-chain ${onchain} vs cache ${cached}`,
          dedupeKey: `tok-rec:${row.hot_wallet_id}:${row.token_id}`,
          context: { chain_id: row.chain_id, symbol: row.symbol, token_id: row.token_id },
        });
        await logTreasuryAudit({
          action: 'treasury_token_onchain_mismatch',
          resourceType: 'hot_wallet_token',
          resourceId: row.token_id,
          details: {
            chain_id: row.chain_id,
            diff: diff.toString(),
            symbol: row.symbol,
          },
        });
      } else {
        await db.query(
          `INSERT INTO hot_wallet_token_balances (hot_wallet_id, token_id, balance_raw, updated_at)
           VALUES ($1::uuid, $2::uuid, $3::numeric, NOW())
           ON CONFLICT (hot_wallet_id, token_id) DO UPDATE SET balance_raw = EXCLUDED.balance_raw, updated_at = NOW()`,
          [row.hot_wallet_id, row.token_id, onchain.toString()]
        );
      }
    } catch (e) {
      logger.warn('treasury_token_reconcile: row failed', {
        token: row.symbol,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    }
  }

  return { checked: rows.rows.length, mismatches };
}

export function startTreasuryTokenReconcileJob(intervalMs: number): NodeJS.Timeout {
  void runTreasuryTokenReconcileOnce().catch((e) =>
    logger.error('treasury_token_reconcile: run failed', { error: e instanceof Error ? e.message : String(e) })
  );
  return setInterval(() => {
    void runTreasuryTokenReconcileOnce().catch((e) =>
      logger.error('treasury_token_reconcile: run failed', { error: e instanceof Error ? e.message : String(e) })
    );
  }, intervalMs);
}
