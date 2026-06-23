/**
 * RPC Bridge — staging verification (M3, staging-gated).
 *
 * Validates services/integration-rpc-bridge.service.ts WITHOUT touching any real
 * chain row. It creates a throwaway chain (`rpcbridge_test*`), exercises every
 * code path, asserts results, snapshots real chains before/after to prove they
 * are untouched, then deletes the throwaway rows.
 *
 *   cd apps/backend && npx tsx scripts/rpc-bridge-staging-verify.ts
 *
 * Exit code 0 = all PASS. Non-zero = a FAIL (do NOT promote to production).
 */
import 'dotenv/config';
import { db } from '../src/lib/database.js';
import { syncRpcToChains } from '../src/services/integration-rpc-bridge.service.js';

const TEST_ID = 'rpcbridge_test';
const TEST_NAME_ID = 'rpcbridge_tn';
const TEST_NAME = 'rpcbridge name match';

let passed = 0;
let failed = 0;
function assert(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`); }
}

async function insertTestChain(id: string, name: string, rpcUrl: string) {
  await db.query(
    `INSERT INTO chains (id, name, type, native_currency, decimals, rpc_url, ws_url, explorer_url, is_active)
     VALUES ($1, $2, 'evm', 'TST', 18, $3, NULL, 'https://example.test', TRUE)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, rpc_url = EXCLUDED.rpc_url, ws_url = NULL`,
    [id, name, rpcUrl],
  );
}
async function getChain(id: string) {
  const r = await db.query<{ rpc_url: string; ws_url: string | null; updated_at: string }>(
    `SELECT rpc_url, ws_url, updated_at::text FROM chains WHERE id = $1`, [id],
  );
  return r.rows[0] ?? null;
}
async function cleanup() {
  await db.query(`DELETE FROM chains WHERE id = ANY($1::varchar[])`, [[TEST_ID, TEST_NAME_ID]]);
}

async function main() {
  console.log('=== RPC Bridge staging verification ===\n');

  // Snapshot REAL chains to prove they are never touched by the test.
  const realBefore = await db.query<{ id: string; rpc_url: string; ws_url: string | null }>(
    `SELECT id, rpc_url, ws_url FROM chains WHERE id NOT IN ($1, $2) ORDER BY id`, [TEST_ID, TEST_NAME_ID],
  );
  const realBeforeJson = JSON.stringify(realBefore.rows);
  console.log(`Snapshot: ${realBefore.rows.length} real chain row(s) recorded.\n`);

  try {
    await cleanup();

    // ── T1: id match — primary update path ──
    await insertTestChain(TEST_ID, 'rpcbridge test', 'https://old.example/rpc');
    const r1 = await syncRpcToChains(TEST_ID, 'https://new.example/rpc', { ws_url: 'wss://new.example/ws' });
    const c1 = await getChain(TEST_ID);
    assert('T1 returns {updated:true} for id match', r1.updated === true);
    assert('T1 rpc_url updated', c1?.rpc_url === 'https://new.example/rpc', c1?.rpc_url);
    assert('T1 ws_url synced from additional_config', c1?.ws_url === 'wss://new.example/ws', String(c1?.ws_url));

    // ── T2: idempotency — running again is safe & stable ──
    const r2 = await syncRpcToChains(TEST_ID, 'https://new.example/rpc', { ws_url: 'wss://new.example/ws' });
    const c2 = await getChain(TEST_ID);
    assert('T2 idempotent (updated:true, same values)', r2.updated === true && c2?.rpc_url === 'https://new.example/rpc');

    // ── T3: ws_url preserved when not supplied (COALESCE) ──
    await syncRpcToChains(TEST_ID, 'https://newer.example/rpc', {});
    const c3 = await getChain(TEST_ID);
    assert('T3 rpc_url changes, ws_url preserved when omitted', c3?.rpc_url === 'https://newer.example/rpc' && c3?.ws_url === 'wss://new.example/ws', JSON.stringify(c3));

    // ── T4: name match (case-insensitive) ──
    await insertTestChain(TEST_NAME_ID, TEST_NAME, 'https://old.name/rpc');
    const r4 = await syncRpcToChains(TEST_NAME.toUpperCase(), 'https://byname.example/rpc', {});
    const c4 = await getChain(TEST_NAME_ID);
    assert('T4 matches by case-insensitive name', r4.updated === true && c4?.rpc_url === 'https://byname.example/rpc', JSON.stringify(c4));

    // ── T5: non-matching slug — no-op, no throw ──
    const r5 = await syncRpcToChains('does_not_exist_xyz', 'https://x.example', {});
    assert('T5 non-matching slug returns {updated:false}', r5.updated === false);

    // ── T6: empty input guard ──
    const r6a = await syncRpcToChains('', 'https://x', {});
    const r6b = await syncRpcToChains(TEST_ID, '', {});
    assert('T6 empty slug/url guarded (updated:false)', r6a.updated === false && r6b.updated === false);

    // ── T7: live-reader read-back (simulates withdrawal-signing / indexer) ──
    const live = await db.query<{ rpc_url: string }>(`SELECT rpc_url FROM chains WHERE LOWER(id) = $1`, [TEST_ID]);
    assert('T7 live reader sees Center-synced rpc_url', live.rows[0]?.rpc_url === 'https://newer.example/rpc');

  } finally {
    await cleanup();
  }

  // ── T8: real chains untouched ──
  const realAfter = await db.query<{ id: string; rpc_url: string; ws_url: string | null }>(
    `SELECT id, rpc_url, ws_url FROM chains WHERE id NOT IN ($1, $2) ORDER BY id`, [TEST_ID, TEST_NAME_ID],
  );
  assert('T8 real chains UNCHANGED by test', JSON.stringify(realAfter.rows) === realBeforeJson);

  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===`);
  await db.close?.();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error('FATAL', e);
  try { await cleanup(); } catch { /* ignore */ }
  process.exit(2);
});
