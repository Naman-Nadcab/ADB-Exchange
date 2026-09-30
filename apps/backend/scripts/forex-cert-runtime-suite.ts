/**
 * DB-backed runtime certification for exchange_forex_cert only.
 * FOREX_CERT_DATABASE_URL=... npx tsx scripts/forex-cert-runtime-suite.ts
 */
import assert from 'node:assert/strict';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
if (!certUrl) {
  console.error('FAIL: FOREX_CERT_DATABASE_URL unset');
  process.exit(1);
}
if (!certUrl.includes('exchange_forex_cert')) {
  console.error('FAIL: URL must target exchange_forex_cert');
  process.exit(1);
}

process.env.DATABASE_URL = certUrl;

const { db } = await import('../src/lib/database.js');
const { hydrateAccountPositionModes } = await import('../src/services/forex/positions/account-mode-persist.js');
const { getAccountPositionMode, setAccountPositionMode } = await import('../src/services/forex/positions/account-mode.js');
const {
  hydrateForexAccountLeveragePoliciesFromDb,
  refreshForexAccountLeveragePolicyForAccount,
} = await import('../src/services/forex/account/account-leverage-policy.js');
const { hydrateForexAccountGroupRuntimePoliciesFromDb } = await import('../src/services/forex/account/account-group-runtime-policy.js');
const { getForexAccountPolicy } = await import('../src/services/forex/risk/engine.js');
const { resolveEffectiveLimits } = await import('../src/services/forex/risk/policy.js');
const { resolveForexSwap } = await import('../src/services/forex/swap/policy.js');
const { calculateForexSwap } = await import('../src/services/forex/swap/engine.js');
const { resolveForexCommission } = await import('../src/services/forex/fees/policy.js');
const { calculateForexCommission } = await import('../src/services/forex/fees/engine.js');
const { fxDecimal } = await import('../src/services/forex/decimal-fx.js');
const { positionMarginSnapshot } = await import('../src/services/forex/margin/engine.js');

const results: { test: string; result: string; evidence: string }[] = [];

function pass(name: string, evidence: string) {
  results.push({ test: name, result: 'PASS', evidence });
}

async function main() {
  const dbName = (await db.query('SELECT current_database() AS n')).rows[0]?.n;
  assert.equal(String(dbName), 'exchange_forex_cert');

  for (const t of ['forex_accounts', 'forex_account_groups', 'forex_crm_leads']) {
    const r = await db.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS ok`,
      [t],
    );
    assert.equal(r.rows[0]?.ok, true, `missing ${t}`);
  }
  pass('schema_core_tables', `db=${dbName}`);

  // position_mode: DB → clear memory → hydrate → runtime
  setAccountPositionMode('CERT_ACC_B', 'NETTING');
  const n = await hydrateAccountPositionModes();
  assert.ok(n >= 1);
  const dbMode = (
    await db.query(`SELECT position_mode FROM forex_accounts WHERE account_id='CERT_ACC_B'`)
  ).rows[0]?.position_mode;
  assert.equal(String(dbMode), 'HEDGING');
  assert.equal(getAccountPositionMode('CERT_ACC_B'), 'HEDGING');
  pass('position_mode_hydrate', `db=HEDGING runtime=${getAccountPositionMode('CERT_ACC_B')}`);

  await hydrateForexAccountLeveragePoliciesFromDb();
  await hydrateForexAccountGroupRuntimePoliciesFromDb();

  const levA = getForexAccountPolicy('CERT_ACC_A').maxLeverage;
  assert.ok(fxDecimal(levA).lte(50));
  const levB = getForexAccountPolicy('CERT_ACC_B').maxLeverage;
  assert.equal(levB, '25');
  pass('leverage_runtime', `ACC_A=${levA} ACC_B=${levB}`);

  const snapB = positionMarginSnapshot({
    symbol: 'EURUSD',
    volume: '0.01',
    entryPrice: '1.10000',
    currentPrice: '1.10000',
    accountMaxLeverage: getForexAccountPolicy('CERT_ACC_B').maxLeverage,
  });
  const snapDefault = positionMarginSnapshot({
    symbol: 'EURUSD',
    volume: '0.01',
    entryPrice: '1.10000',
    currentPrice: '1.10000',
    accountMaxLeverage: '100',
  });
  assert.ok(fxDecimal(snapB.leverage).lte(fxDecimal(snapDefault.leverage)));
  pass('margin_uses_effective_leverage', `levB=${snapB.leverage}`);

  const spreadA = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: 'CERT_ACC_A' }).maxSpread;
  const spreadB = resolveEffectiveLimits({ symbol: 'EURUSD', accountId: 'CERT_ACC_B' }).maxSpread;
  assert.ok(fxDecimal(spreadA).lt(fxDecimal(spreadB)));
  pass('group_spread_maxSpread', `A=${spreadA} B=${spreadB}`);

  const swapA = resolveForexSwap('EURUSD', 'CERT_ACC_A').longSwap;
  const swapB = resolveForexSwap('EURUSD', 'CERT_ACC_B').longSwap;
  assert.equal(swapA, '1.5');
  assert.equal(swapB, '3');
  const swapCalc = calculateForexSwap({
    symbol: 'EURUSD',
    side: 'long',
    volume: '1',
    at: new Date('2026-09-01T21:00:00.000Z'),
    accountId: 'CERT_ACC_B',
  });
  assert.equal(swapCalc.rate, '3');
  pass('group_swap_runtime', `A=${swapA} B=${swapB} calc=${swapCalc.rate}`);

  const commA = resolveForexCommission('CERT_ACC_A', 'EURUSD').rate;
  const commB = resolveForexCommission('CERT_ACC_B', 'EURUSD').rate;
  assert.equal(commA, '5');
  assert.equal(commB, '10');
  assert.equal(calculateForexCommission({ accountId: 'CERT_ACC_B', symbol: 'EURUSD', side: 'buy', volume: '1' }).amount, '10');
  pass('group_commission_runtime', `A=${commA} B=${commB}`);

  await refreshForexAccountLeveragePolicyForAccount('CERT_ACC_A');
  assert.equal(getForexAccountPolicy('CERT_ACC_A').maxLeverage, levA);
  pass('leverage_refresh_idempotent', levA);

  console.log(JSON.stringify({ suite: 'forex-cert-runtime', results }, null, 2));
  await db.close();
}

main().catch(async (e) => {
  console.error('FAIL', e);
  try {
    await db.close();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
