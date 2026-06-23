#!/usr/bin/env tsx
/**
 * Provision one hot wallet per supported chain family (evm, bitcoin, solana, tron, polkadot).
 * Idempotent: skips families that already have an active hot wallet.
 *
 * Usage (from repo root):
 *   npm run provision:hot-wallets --workspace=@exchange/backend
 *   # or: bash scripts/provision-hot-wallets.sh
 *
 * Required env:
 *   DATABASE_URL
 *   ENCRYPTION_KEY (min 32 chars)
 *   KMS_TYPE=local (dev) | aws (production with AWS_KMS_KEY_ID + AWS_REGION)
 *
 * Optional:
 *   PROVISION_ACTOR_ADMIN_ID — admin_users.id for audit log (default: first super_admin)
 *   DRY_RUN=1 — list families only, do not create
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { db } from '../src/lib/database.js';
import { validateHotWalletEnv } from '../src/lib/hot-wallet-env.js';
import {
  listChainFamiliesInDb,
  createHotWalletByFamily,
  familyHasHotWallet,
  HotWalletServiceError,
} from '../src/services/hot-wallet.service.js';

const DRY_RUN = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';

async function resolveActorId(): Promise<string> {
  const explicit = process.env.PROVISION_ACTOR_ADMIN_ID?.trim();
  if (explicit) return explicit;
  const r = await db.query<{ id: string }>(
    `SELECT id::text FROM admin_users
     WHERE is_active = TRUE
       AND (role ILIKE '%super%' OR role = 'super_admin')
     ORDER BY created_at ASC NULLS LAST
     LIMIT 1`
  );
  const id = r.rows[0]?.id;
  if (!id) {
    throw new Error(
      'No super_admin found. Set PROVISION_ACTOR_ADMIN_ID or seed admin_users first.'
    );
  }
  return id;
}

async function main(): Promise<void> {
  validateHotWalletEnv();
  const actorId = await resolveActorId();
  const families = await listChainFamiliesInDb();

  console.log('=== Hot wallet provisioning ===');
  console.log(`Actor admin id: ${actorId}`);
  console.log(`KMS_TYPE: ${process.env.KMS_TYPE ?? 'local'}`);
  console.log(`Families in DB: ${families.length}`);
  if (DRY_RUN) console.log('DRY_RUN=1 — no wallets will be created');

  const created: Array<{ family: string; address: string; chainId: string }> = [];
  const skipped: string[] = [];
  const errors: Array<{ family: string; message: string }> = [];

  for (const f of families) {
    if (!f.creationSupported) {
      skipped.push(`${f.type} (creation not supported for type)`);
      continue;
    }
    const has = await familyHasHotWallet(f.type);
    if (has) {
      skipped.push(`${f.type} (already provisioned)`);
      continue;
    }
    if (DRY_RUN) {
      console.log(`[dry-run] would create: ${f.type} via chain ${f.representativeChainId}`);
      continue;
    }
    try {
      const result = await createHotWalletByFamily(
        f.type,
        actorId,
        '127.0.0.1',
        'provision-hot-wallets-script'
      );
      created.push({ family: f.type, address: result.address, chainId: result.chainId });
      console.log(`✓ ${f.type}: ${result.address} (chain_id=${result.chainId})`);
    } catch (e) {
      const msg =
        e instanceof HotWalletServiceError
          ? `${e.code}: ${e.message}`
          : e instanceof Error
            ? e.message
            : String(e);
      errors.push({ family: f.type, message: msg });
      console.error(`✗ ${f.type}: ${msg}`);
    }
  }

  const summary = await db.query<{ cnt: string }>(
    `SELECT COUNT(DISTINCT c.type)::text AS cnt
     FROM hot_wallets hw
     INNER JOIN chains c ON c.id = hw.chain_id
     WHERE hw.is_active = TRUE`
  );
  const familyCount = Number(summary.rows[0]?.cnt ?? 0);

  console.log('\n=== Summary ===');
  console.log(`Created: ${created.length}`);
  console.log(`Skipped: ${skipped.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Active hot-wallet families: ${familyCount}`);
  if (skipped.length) console.log('Skipped:', skipped.join(', '));

  if (errors.length > 0) process.exit(1);
  if (!DRY_RUN && created.length === 0 && familyCount === 0) {
    console.error('No hot wallet families configured after run.');
    process.exit(1);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(async () => {
    try {
      await db.end();
    } catch {
      /* ignore */
    }
  });
