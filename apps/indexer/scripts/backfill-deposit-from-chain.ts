/**
 * One-shot: scan recent blocks for USDT to a deposit address and insert deposit row if missing.
 * Usage: npx tsx scripts/backfill-deposit-from-chain.ts <email> [chainKey]
 */
import { ethers } from 'ethers';
import pg from 'pg';

const email = process.argv[2];
const chainKey = (process.argv[3] || 'bsc').toLowerCase();
if (!email) {
  console.error('Usage: backfill-deposit-from-chain.ts <email> [chainKey]');
  process.exit(1);
}

const RPC: Record<string, string> = {
  bsc: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  ethereum: process.env.ETH_RPC_URL || 'https://ethereum.publicnode.com',
  polygon: process.env.POLYGON_RPC_URL || 'https://polygon-bor.publicnode.com',
};
const USDT: Record<string, { address: string; decimals: number }> = {
  bsc: { address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
  ethereum: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  polygon: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
};
const TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const REQUIRED_CONFIRMATIONS = 15;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL required');
  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const user = await client.query<{ id: string }>(`SELECT id::text FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`, [email]);
  const userId = user.rows[0]?.id;
  if (!userId) throw new Error('user not found');

  const wallet = await client.query<{ id: string; address: string }>(
    `SELECT id::text, address FROM wallets WHERE user_id=$1::uuid AND chain_id=$2 LIMIT 1`,
    [userId, chainKey]
  );
  const w = wallet.rows[0];
  if (!w) throw new Error('wallet not found for chain');

  const rpc = RPC[chainKey];
  const token = USDT[chainKey];
  if (!rpc || !token) throw new Error(`unsupported chain ${chainKey}`);

  const provider = new ethers.JsonRpcProvider(rpc);
  const tip = await provider.getBlockNumber();
  const from = Math.max(0, tip - 80_000);
  const addr = w.address.toLowerCase();
  const logs: ethers.Log[] = [];
  const CHUNK = 1500;
  for (let start = from; start <= tip; start += CHUNK) {
    const end = Math.min(start + CHUNK - 1, tip);
    try {
      const batch = await provider.getLogs({
        address: token.address,
        fromBlock: start,
        toBlock: end,
        topics: [TOPIC, null, ethers.zeroPadValue(addr, 32)],
      });
      logs.push(...batch);
    } catch (e) {
      console.warn(`chunk ${start}-${end} failed`, e instanceof Error ? e.message : e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  console.log(`Found ${logs.length} token transfer(s) to ${addr} on ${chainKey}`);

  const cur = await client.query<{ id: string }>(`SELECT id::text FROM currencies WHERE UPPER(symbol)='USDT' LIMIT 1`);
  const currencyId = cur.rows[0]?.id;
  if (!currencyId) throw new Error('USDT currency missing');

  for (const log of logs) {
    const amount = ethers.formatUnits(log.data, token.decimals);
    const block = await provider.getBlock(log.blockNumber);
    const confirmations = Math.max(0, tip - Number(log.blockNumber));
    const ins = await client.query(
      `INSERT INTO deposits (
        user_id, currency_id, chain_id, wallet_id, tx_hash, from_address, to_address,
        amount, fee, confirmations, required_confirmations, block_number, block_timestamp,
        status, created_at, updated_at
      ) VALUES (
        $1::uuid, $2::uuid, $3, $4::uuid, $5, $6, $7,
        $8::numeric, 0, $9, $10, $11, to_timestamp($12),
        'pending', NOW(), NOW()
      )
      ON CONFLICT (chain_id, tx_hash, to_address) DO NOTHING
      RETURNING id::text`,
      [
        userId,
        currencyId,
        chainKey,
        w.id,
        log.transactionHash,
        '0x' + log.topics[1]!.slice(26),
        addr,
        amount,
        confirmations,
        REQUIRED_CONFIRMATIONS,
        log.blockNumber,
        block?.timestamp ?? Math.floor(Date.now() / 1000),
      ]
    );
    if (ins.rowCount) {
      console.log('Inserted pending deposit', log.transactionHash, amount, 'USDT', `(conf=${confirmations})`);
      await client.query(
        `INSERT INTO user_balances (id, user_id, currency_id, chain_id, available_balance, pending_balance, account_type, updated_at)
         VALUES (gen_random_uuid(), $1::uuid, $2::uuid, '', 0, $3::numeric, 'funding', NOW())
         ON CONFLICT (user_id, currency_id, chain_id, account_type)
         DO UPDATE SET pending_balance = user_balances.pending_balance + $3::numeric, updated_at = NOW()`,
        [userId, currencyId, amount]
      );
    } else {
      console.log('Already recorded', log.transactionHash);
    }
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
