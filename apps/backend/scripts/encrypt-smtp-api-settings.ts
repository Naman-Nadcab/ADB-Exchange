/**
 * Re-encrypt active SMTP api_secret in api_settings (if stored plaintext).
 * Run: cd apps/backend && npx tsx scripts/encrypt-smtp-api-settings.ts
 */
import 'dotenv/config';
import { db } from '../src/lib/database.js';
import { encryptProviderSecret } from '../src/lib/hybrid-credentials-crypto.js';

async function main(): Promise<void> {
  const r = await db.query<{ id: string; api_secret: string | null; secret_encrypted: boolean }>(
    `SELECT id::text, api_secret, secret_encrypted FROM api_settings WHERE category = 'email' AND provider = 'smtp' AND is_active = TRUE LIMIT 1`,
  );
  const row = r.rows[0];
  if (!row?.api_secret) {
    console.log('No active SMTP secret to encrypt');
    process.exit(0);
  }
  if (row.secret_encrypted) {
    console.log('SMTP secret already encrypted');
    process.exit(0);
  }
  const enc = encryptProviderSecret(row.api_secret);
  await db.query(
    `UPDATE api_settings SET api_secret = $2, secret_encrypted = TRUE, updated_at = NOW() WHERE id = $1::uuid`,
    [row.id, enc],
  );
  console.log('SMTP secret encrypted at rest');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
