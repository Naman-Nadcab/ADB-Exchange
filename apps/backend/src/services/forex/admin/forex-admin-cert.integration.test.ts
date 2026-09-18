/**
 * Isolated DB certification — runs only when FOREX_CERT_DATABASE_URL is set.
 * Never points at production `exchange` unless explicitly configured for cert.
 */
import assert from 'node:assert/strict';
import pg from 'pg';

const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
if (!certUrl) {
  console.log('forex-admin-cert.integration.test.ts: SKIP (FOREX_CERT_DATABASE_URL unset)');
  process.exit(0);
}

const { Client } = pg;

async function main() {
  const client = new Client({ connectionString: certUrl });
  await client.connect();
  const dbName = (await client.query('SELECT current_database() AS n')).rows[0]?.n;
  assert.notEqual(dbName, 'exchange', 'Refusing to run cert tests against live exchange DB name');

  const tables = ['forex_accounts', 'forex_account_groups', 'forex_crm_leads'];
  for (const t of tables) {
    const r = await client.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1) AS ok`,
      [t],
    );
    assert.equal(r.rows[0]?.ok, true, `missing table ${t} — run migrate on cert DB`);
  }

  const modeCol = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_name = 'forex_accounts' AND column_name = 'position_mode'
     ) AS ok`,
  );
  assert.equal(modeCol.rows[0]?.ok, true, 'position_mode column missing');

  await client.end();
  console.log(`forex-admin-cert.integration.test.ts: PASS (db=${dbName})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
