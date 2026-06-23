/**
 * Ensure default admin users exist for admin panel login.
 * Production: pre-enables 2FA (required when NODE_ENV=production) and prints bootstrap TOTP secret.
 *
 * Run: cd apps/backend && npx tsx seed-admin.ts
 * Docker: docker compose -f docker-compose.production.yml --profile tools run --rm seed-admin
 */
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import bcrypt from 'bcryptjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const ADMINS = [
  { email: 'test@gmail.com', password: 'test123', name: 'Super Admin', role: 'super_admin', permissions: ['all'] },
  { email: 'approver@example.com', password: 'approver123', name: 'Withdrawal Approver', role: 'withdrawal_approver', permissions: ['withdrawals:approve'] },
] as const;

function base32Encode(buffer: Buffer): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]!;
    bits += 8;
    while (bits >= 5) {
      output += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += alphabet[(value << (5 - bits)) & 31];
  }
  return output;
}

/** Matches apps/backend/src/lib/encryption.ts (AES-256-GCM iv:tag:ciphertext). */
function encryptSecret(plaintext: string, encryptionKey: string): string {
  const keyBuffer = crypto.createHash('sha256').update(encryptionKey).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64'), authTag.toString('base64'), Buffer.from(encrypted, 'hex').toString('base64')].join(':');
}

function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code).digest('hex');
}

function generateBootstrap2FA(email: string): {
  base32: string;
  encryptedSecret: string;
  backupHashes: string[];
  qrHint: string;
} {
  const base32 = base32Encode(crypto.randomBytes(20));
  const encKey = process.env.ENCRYPTION_KEY?.trim();
  if (!encKey || encKey.length < 32) {
    throw new Error('ENCRYPTION_KEY must be set (≥32 chars) to bootstrap admin 2FA secrets');
  }
  const backupCodes = Array.from({ length: 10 }, () => crypto.randomBytes(4).toString('hex').toUpperCase());
  const issuer = encodeURIComponent('CryptoExchange');
  const account = encodeURIComponent(email);
  return {
    base32,
    encryptedSecret: encryptSecret(base32, encKey),
    backupHashes: backupCodes.map(hashBackupCode),
    qrHint: `otpauth://totp/${issuer}:${account}?secret=${base32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`,
  };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set.');
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  const bootstrapSecrets: Array<{ email: string; base32: string; qrHint: string }> = [];
  try {
    await client.connect();

    const tableExists = await client.query(`
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'admin_users'
    `);
    if (tableExists.rows.length === 0) {
      console.error('Table admin_users does not exist. Run migrations first: npm run migrate');
      process.exit(1);
    }

    const permsType = await client.query(`
      SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users' AND column_name = 'permissions'
    `);
    const isJsonb = permsType.rows[0]?.data_type === 'jsonb';

    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'admin_users'
        AND column_name IN ('two_factor_enabled', 'two_factor_secret', 'two_factor_backup_codes')
    `);
    const has2faCols = colCheck.rows.length >= 3;

    for (const admin of ADMINS) {
      const existing = await client.query(
        'SELECT id, email, two_factor_enabled FROM admin_users WHERE email = $1',
        [admin.email.toLowerCase()]
      );
      if (existing.rows.length > 0) {
        const row = existing.rows[0] as { email: string; two_factor_enabled?: boolean };
        console.log('Admin already exists:', row.email, row.two_factor_enabled ? '(2FA enabled)' : '(2FA not enabled — run manual 2FA setup)');
        continue;
      }

      const passwordHash = await bcrypt.hash(admin.password, 12);
      let adminId: string;
      if (isJsonb) {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO admin_users (id, email, password_hash, name, role, permissions, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::jsonb, TRUE)
           RETURNING id`,
          [admin.email.toLowerCase(), passwordHash, admin.name, admin.role, JSON.stringify(admin.permissions)]
        );
        adminId = ins.rows[0]!.id;
      } else {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO admin_users (id, email, password_hash, name, role, permissions, is_active)
           VALUES (gen_random_uuid(), $1, $2, $3, $4, $5::text[], TRUE)
           RETURNING id`,
          [admin.email.toLowerCase(), passwordHash, admin.name, admin.role, admin.permissions]
        );
        adminId = ins.rows[0]!.id;
      }

      if (has2faCols) {
        const tfa = generateBootstrap2FA(admin.email);
        await client.query(
          `UPDATE admin_users
           SET two_factor_enabled = TRUE, two_factor_secret = $2, two_factor_backup_codes = $3
           WHERE id = $1`,
          [adminId, tfa.encryptedSecret, tfa.backupHashes]
        );
        bootstrapSecrets.push({ email: admin.email, base32: tfa.base32, qrHint: tfa.qrHint });
      }

      console.log('Created:', admin.email, `(${admin.role})`);
    }

    console.log('\nLogin at: /admin/login');
    console.log('  Super Admin: test@gmail.com / test123');
    console.log('  Withdrawal Approver: approver@example.com / approver123');
    if (bootstrapSecrets.length > 0) {
      console.log('\n=== BOOTSTRAP 2FA (production login requires TOTP) ===');
      for (const s of bootstrapSecrets) {
        console.log(`\n${s.email}`);
        console.log(`  Base32 secret: ${s.base32}`);
        console.log(`  Authenticator URI: ${s.qrHint}`);
        console.log('  Add to Google Authenticator / Authy, then login with password + 6-digit code.');
      }
      console.log('\nChange passwords immediately after first login.');
    }
  } catch (e) {
    console.error('Error:', e instanceof Error ? e.message : e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
