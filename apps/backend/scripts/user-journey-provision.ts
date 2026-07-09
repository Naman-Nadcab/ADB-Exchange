/**
 * Provision two brand-new users for complete user journey certification.
 * Creates users + KYC only; cert script logs in via password (real auth path).
 */
import dotenv from 'dotenv';
import path from 'path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PASSWORD = 'CertFlow123';
const ts = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');

async function main() {
  const pg = (await import('pg')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const crypto = await import('crypto');

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL missing');
    process.exit(1);
  }

  const emailA = process.env.JOURNEY_EMAIL_A || `cert_journey_a_${ts}@local.exchange`;
  const emailB = process.env.JOURNEY_EMAIL_B || `cert_journey_b_${ts}@local.exchange`;

  function pgSslForUrl(connectionString: string): undefined | { rejectUnauthorized: boolean } {
    try {
      const normalized = connectionString.replace(/^postgresql:/i, 'http:').replace(/^postgres:/i, 'http:');
      const u = new URL(normalized);
      const host = (u.hostname || '').toLowerCase();
      if (host === '127.0.0.1' || host === 'localhost' || host === 'postgres' || host.endsWith('.internal')) {
        return undefined;
      }
    } catch {
      /* ignore */
    }
    return process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === 'false' ? { rejectUnauthorized: false } : undefined;
  }

  const client = new pg.Client({ connectionString: url, ssl: pgSslForUrl(url) });
  await client.connect();

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(PASSWORD, salt);
  const salt64 = salt.substring(0, 64);

  function randomRef(prefix: string): string {
    return `${prefix}${crypto.randomBytes(4).toString('hex')}`.toUpperCase().slice(0, 10);
  }

  async function createFreshUser(email: string): Promise<string> {
    for (let i = 0; i < 5; i++) {
      try {
        const ins = await client.query<{ id: string }>(
          `INSERT INTO users (email, email_verified, password_hash, salt, status, referral_code)
           VALUES ($1, TRUE, $2, $3, 'active', $4)
           RETURNING id`,
          [email.toLowerCase(), hash, salt64, randomRef('J')]
        );
        return ins.rows[0]!.id;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/unique|duplicate|referral/i.test(msg)) {
          email = email.replace('@', `_${i}@`);
          continue;
        }
        throw e;
      }
    }
    throw new Error('Could not create user');
  }

  async function approveKyc(userId: string): Promise<void> {
    await client.query(
      `INSERT INTO kyc_applications (user_id, status, kyc_level, submitted_at, reviewed_at)
       SELECT $1, 'approved', 1, NOW(), NOW()
       WHERE NOT EXISTS (SELECT 1 FROM kyc_applications WHERE user_id = $1 AND status = 'approved')`,
      [userId]
    );
    await client.query(
      `UPDATE kyc_applications SET status = 'approved', kyc_level = 1, reviewed_at = NOW() WHERE user_id = $1`,
      [userId]
    );
  }

  const idA = await createFreshUser(emailA);
  const idB = await createFreshUser(emailB);
  await approveKyc(idA);
  await approveKyc(idB);

  const usdtToken = await client.query<{ id: string }>(
    `SELECT id FROM tokens WHERE symbol = 'USDT' AND is_active = TRUE ORDER BY created_at NULLS LAST LIMIT 1`
  );

  await client.end();

  const out = {
    EMAIL_A: emailA.toLowerCase(),
    EMAIL_B: emailB.toLowerCase(),
    PASSWORD,
    USER_A_ID: idA,
    USER_B_ID: idB,
    USDT_TOKEN_ID: usdtToken.rows[0]?.id ?? '',
    createdAt: new Date().toISOString(),
  };

  const emitPath = process.argv.includes('--emit-json')
    ? process.argv[process.argv.indexOf('--emit-json') + 1]
    : null;
  if (emitPath) {
    mkdirSync(path.dirname(emitPath), { recursive: true });
    writeFileSync(emitPath, JSON.stringify(out, null, 2));
  }
  console.log(JSON.stringify(out));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
