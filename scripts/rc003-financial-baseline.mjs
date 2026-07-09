#!/usr/bin/env node
/**
 * RC-003: Financial baseline verification (read-only).
 */
import { execSync } from 'node:child_process';

function psql(sql) {
  return execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(sql)}`,
    { encoding: 'utf8' },
  ).trim();
}

const checks = {
  pending: psql("SELECT COUNT(*) FROM settlement_events WHERE status='pending'"),
  failed: psql("SELECT COUNT(*) FROM settlement_events WHERE status='failed'"),
  processed: psql("SELECT COUNT(*) FROM settlement_events WHERE status='processed'"),
  quarantined: psql("SELECT COUNT(*) FROM settlement_events WHERE status='quarantined'"),
  zombie: psql(
    "SELECT COUNT(*) FROM settlement_events se WHERE status='processed' AND NOT EXISTS (SELECT 1 FROM settlement_ledger_entries sle WHERE sle.settlement_event_id=se.id)",
  ),
  negative_balances: psql(
    'SELECT COUNT(*) FROM user_balances WHERE available_balance < 0 OR locked_balance < 0',
  ),
  dup_settlement: psql(
    'SELECT COUNT(*) FROM (SELECT match_engine_id, engine_event_id FROM settlement_events GROUP BY 1,2 HAVING COUNT(*)>1) d',
  ),
  orphan_ledger: psql(
    'SELECT COUNT(*) FROM settlement_ledger_entries sle WHERE NOT EXISTS (SELECT 1 FROM settlement_events se WHERE se.id=sle.settlement_event_id)',
  ),
  spot_trades: psql('SELECT COUNT(*) FROM spot_trades'),
  ledger_rows: psql('SELECT COUNT(*) FROM settlement_ledger_entries'),
};

console.log('RC003_FINANCIAL_BASELINE', JSON.stringify(checks, null, 2));

const fail =
  parseInt(checks.negative_balances, 10) > 0 ||
  parseInt(checks.dup_settlement, 10) > 0;

if (fail) process.exit(1);
