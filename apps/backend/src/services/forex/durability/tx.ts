/**
 * Forex-only PostgreSQL transaction helpers.
 * Never used for Crypto settlement or user_balances.
 */
import type { PoolClient } from 'pg';
import { db } from '../../../lib/database.js';

export type ForexQueryable = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[]; rowCount: number | null }>;
};

export function fxq(client?: ForexQueryable): ForexQueryable {
  return client ?? db;
}

export async function withForexTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

export async function lockForexAccount(client: ForexQueryable, accountId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`fx:acct:${accountId}`]);
}

export async function lockForexPosition(client: ForexQueryable, accountId: string, symbol: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [`fx:pos:${accountId}`, symbol]);
}

export async function lockForexSwapKey(client: ForexQueryable, idempotencyKey: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`fx:swap:${idempotencyKey}`]);
}

export async function lockForexLiquidationAccount(client: ForexQueryable, accountId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`fx:liq:${accountId}`]);
}

export async function lockForexClientOrder(client: ForexQueryable, accountId: string, clientOrderId: string): Promise<void> {
  await client.query(`SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))`, [
    `fx:coid:${accountId}`,
    clientOrderId,
  ]);
}
