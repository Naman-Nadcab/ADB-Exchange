/**
 * Provision authenticated test personas for interactive UI audit.
 * Run: cd apps/backend && npx tsx scripts/interactive-audit-provision.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import { writeFileSync, mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const PASSWORD = 'AuditPass123!';
const USERS = {
  normal: { email: 'audit_normal@local.exchange', label: 'normal' },
  kyc: { email: 'audit_kyc@local.exchange', label: 'kyc_approved' },
} as const;
const ADMIN = { email: process.env.ADMIN_EMAIL || 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'admin123' };

const API = (process.env.API_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const OUT = path.resolve(__dirname, '../../../audit/interactive/data/users.json');

async function main() {
  const pg = (await import('pg')).default;
  const bcrypt = (await import('bcryptjs')).default;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');

  const client = new pg.Client({ connectionString: url });
  await client.connect();

  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(PASSWORD, salt);
  const salt64 = salt.substring(0, 64);

  async function ensureUser(email: string): Promise<string> {
    const ex = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL`,
      [email]
    );
    if (ex.rows[0]) return ex.rows[0].id;
    const ref = `AUD${randomUUID().slice(0, 6).toUpperCase()}`;
    const ins = await client.query<{ id: string }>(
      `INSERT INTO users (email, email_verified, password_hash, salt, status, referral_code)
       VALUES ($1, TRUE, $2, $3, 'active', $4) RETURNING id`,
      [email.toLowerCase(), hash, salt64, ref]
    );
    return ins.rows[0]!.id;
  }

  const normalId = await ensureUser(USERS.normal.email);
  const kycId = await ensureUser(USERS.kyc.email);

  await client.query(
    `INSERT INTO kyc_records (user_id, status, level, pan_verified, aadhaar_verified, liveness_verified, submitted_at, reviewed_at)
     VALUES ($1, 'approved', 2, TRUE, TRUE, TRUE, NOW(), NOW())
     ON CONFLICT (user_id) DO UPDATE SET status='approved', level=2, updated_at=NOW()`,
    [kycId]
  );

  // Fund normal + kyc traders for spot/wallet UI
  const cur = await client.query<{ id: string; symbol: string }>(
    `SELECT id, symbol FROM currencies WHERE UPPER(symbol) IN ('BTC','USDT')`
  );
  const btc = cur.rows.find((r) => r.symbol.toUpperCase() === 'BTC')?.id;
  const usdt = cur.rows.find((r) => r.symbol.toUpperCase() === 'USDT')?.id;
  if (btc && usdt) {
    for (const uid of [normalId, kycId]) {
      for (const [cid, amt] of [[btc, '1'], [usdt, '100000']] as const) {
        await client.query(
          `INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance)
           VALUES ($1, $2, '', 'trading', $3::numeric, 0)
           ON CONFLICT (user_id, currency_id, chain_id, account_type)
           DO UPDATE SET available_balance = GREATEST(user_balances.available_balance, EXCLUDED.available_balance)`,
          [uid, cid, amt]
        );
      }
    }
  }

  await client.end();

  async function loginUser(email: string) {
    const res = await fetch(`${API}/api/v1/auth/login/password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: PASSWORD }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`User login failed ${email}: ${JSON.stringify(data.error)}`);
    return {
      email,
      accessToken: data.data.accessToken as string,
      refreshToken: data.data.refreshToken as string,
      user: data.data.user,
    };
  }

  async function loginAdmin() {
    const res = await fetch(`${API}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN.email, password: ADMIN.password }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(`Admin login failed: ${JSON.stringify(data.error)}`);
    return {
      email: ADMIN.email,
      accessToken: data.data.accessToken as string,
      admin: data.data.admin,
    };
  }

  const normal = await loginUser(USERS.normal.email);
  const kyc = await loginUser(USERS.kyc.email);
  const admin = await loginAdmin();

  const payload = {
    generatedAt: new Date().toISOString(),
    password: PASSWORD,
    apiBase: API,
    users: {
      normal: { ...normal, userId: normalId, role: 'normal' },
      kyc: { ...kyc, userId: kycId, role: 'kyc_approved' },
      admin: { ...admin, role: 'admin' },
    },
  };

  mkdirSync(path.dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log('Wrote', OUT);
  console.log(JSON.stringify({ normal: USERS.normal.email, kyc: USERS.kyc.email, admin: ADMIN.email, password: PASSWORD }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
