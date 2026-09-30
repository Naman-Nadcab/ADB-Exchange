/**
 * Minimal certification fixtures — ONLY for exchange_forex_cert.
 * Run: FOREX_CERT_DATABASE_URL=... npx tsx scripts/forex-cert-seed.ts
 */
const certUrl = process.env.FOREX_CERT_DATABASE_URL?.trim();
if (!certUrl) {
  console.error('FOREX_CERT_DATABASE_URL required');
  process.exit(1);
}
if (/[/]exchange(\?|$)/.test(certUrl) && !certUrl.includes('exchange_forex_cert')) {
  console.error('Refusing to seed non-cert database');
  process.exit(1);
}

process.env.DATABASE_URL = certUrl;

const { db } = await import('../src/lib/database.js');
const bcrypt = (await import('bcryptjs')).default;

const CERT_PASSWORD = process.env.FOREX_CERT_ADMIN_PASSWORD?.trim() || 'CertAdmin1!';
const TRADER_PASSWORD = process.env.FOREX_CERT_TRADER_PASSWORD?.trim() || 'CertTrader1!';

const MAKER_ID = '11111111-1111-4111-8111-111111111111';
const CHECKER_A_ID = '22222222-2222-4222-8222-222222222222';
const CHECKER_B_ID = '33333333-3333-4333-8333-333333333333';
const TRADER_B_ID = '44444444-4444-4444-8444-444444444444';
const FOREX_ONLY_ID = '77777777-7777-4777-8777-777777777777';
const CONTROL_ONLY_ID = '88888888-8888-4888-8888-888888888888';
const WITHDRAWAL_APPROVER_ID = '99999999-9999-4999-8999-999999999999';

/** UI forex workspace without forex:view (avoids overly broad :view alias → crypto tab). Backend role dealer supplies API forex access. */
const CERT_FOREX_ONLY_UI_PERMISSIONS = [
  'forex:orders:view',
  'forex:positions:view',
  'forex:dealing:view',
  'forex:crm:view',
  'forex:accounts:view',
  'forex:audit:view',
];

async function upsertAdmin(
  id: string,
  email: string,
  role: string,
  name: string,
  password: string,
  permissions: string[] = [],
) {
  const hash = await bcrypt.hash(password, 12);
  await db.query(
    `INSERT INTO admin_users (id, email, password_hash, role, is_active, name, permissions)
     VALUES ($1::uuid, $2, $3, $4, TRUE, $5, $6::text[])
     ON CONFLICT (email) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       role = EXCLUDED.role,
       is_active = TRUE,
       name = EXCLUDED.name,
       permissions = EXCLUDED.permissions`,
    [id, email, hash, role, name, permissions],
  );
}

async function main() {
  const dbName = (await db.query('SELECT current_database() AS n')).rows[0]?.n;
  if (String(dbName) !== 'exchange_forex_cert') {
    throw new Error(`Refusing seed: connected to ${dbName}`);
  }

  await db.query(`DELETE FROM forex_crm_tasks WHERE title LIKE 'CERT_%'`);
  // Upsert cert admins in place (do not DELETE — approval_requests FK).
  await db.query(`DELETE FROM forex_crm_leads WHERE email LIKE 'cert_%@cert.local'`);
  await db.query(`DELETE FROM forex_accounts WHERE account_id LIKE 'CERT_%' OR account_id = $1::text`, [TRADER_B_ID]);
  await db.query(`DELETE FROM forex_account_groups WHERE code LIKE 'CERT_%'`);
  // Never DELETE cert trader user — forex_accounts / journey FKs; upsert password below.

  const gA = await db.query(
    `INSERT INTO forex_account_groups (code, label, leverage_default, position_mode_default, commission_profile, swap_profile, spread_profile)
     VALUES ('CERT_GA', 'Cert Group A', '50', 'NETTING',
       '{"model":"per_lot","rate":"5"}'::jsonb,
       '{"longSwap":"1.5","shortSwap":"-0.75"}'::jsonb,
       '{"maxSpread":"0.01500"}'::jsonb)
     RETURNING group_id`,
  );
  const gB = await db.query(
    `INSERT INTO forex_account_groups (code, label, leverage_default, position_mode_default, commission_profile, swap_profile, spread_profile)
     VALUES ('CERT_GB', 'Cert Group B', '100', 'HEDGING',
       '{"model":"per_lot","rate":"10"}'::jsonb,
       '{"longSwap":"3","shortSwap":"-1.5"}'::jsonb,
       '{"maxSpread":"0.03000"}'::jsonb)
     RETURNING group_id`,
  );
  const groupA = String(gA.rows[0]!.group_id);
  const groupB = String(gB.rows[0]!.group_id);

  const traderHash = await bcrypt.hash(TRADER_PASSWORD, 12);
  const salt = (await bcrypt.genSalt(12)).substring(0, 64);
  let traderId = TRADER_B_ID;
  const existingTrader = await db.query<{ id: string }>(
    `SELECT id FROM users WHERE LOWER(email)=LOWER($1) AND deleted_at IS NULL LIMIT 1`,
    ['cert_trader_b@cert.local'],
  );
  if (existingTrader.rows[0]?.id) {
    traderId = String(existingTrader.rows[0].id);
    await db.query(`UPDATE users SET password_hash = $2, email_verified = TRUE, status = 'active' WHERE id = $1::uuid`, [
      traderId,
      traderHash,
    ]);
  } else {
    const ref = `CERT${Math.random().toString(36).slice(2, 8).toUpperCase()}`.slice(0, 10);
    const ins = await db.query<{ id: string }>(
      `INSERT INTO users (id, email, email_verified, password_hash, salt, status, referral_code)
       VALUES ($1::uuid, $2, TRUE, $3, $4, 'active', $5)
       RETURNING id`,
      [TRADER_B_ID, 'cert_trader_b@cert.local', traderHash, salt, ref],
    );
    traderId = String(ins.rows[0]!.id);
  }

  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, group_id, leverage_override)
     VALUES
       ('CERT_ACC_A', 'CERT_USER_A', 'USD', 'ACTIVE', 'NETTING', $1::uuid, NULL),
       ('CERT_ACC_B', $2::uuid, 'USD', 'ACTIVE', 'HEDGING', $3::uuid, '25')
     ON CONFLICT (account_id) DO UPDATE SET
       user_id = EXCLUDED.user_id,
       group_id = EXCLUDED.group_id,
       position_mode = EXCLUDED.position_mode,
       leverage_override = EXCLUDED.leverage_override,
       updated_at = NOW()`,
    [groupA, traderId, groupB],
  );
  // User Forex API keys accounts by platform user id (account_id = user_id).
  await db.query(
    `INSERT INTO forex_accounts (account_id, user_id, currency, status, position_mode, group_id, leverage_override)
     VALUES ($1::uuid, $1::uuid, 'USD', 'ACTIVE', 'HEDGING', $2::uuid, '25')
     ON CONFLICT (account_id) DO UPDATE SET
       position_mode = EXCLUDED.position_mode,
       group_id = EXCLUDED.group_id,
       leverage_override = EXCLUDED.leverage_override,
       updated_at = NOW()`,
    [traderId, groupB],
  );

  await db.query(
    `INSERT INTO forex_crm_leads (lead_id, email, full_name, status, stage_id)
     SELECT gen_random_uuid(), 'cert_lead_a@cert.local', 'Cert Lead A', 'open', stage_id
     FROM forex_crm_lead_stages ORDER BY sort_order LIMIT 1`,
  );

  await upsertAdmin(MAKER_ID, 'cert_maker@cert.local', 'super_admin', 'Cert Maker', CERT_PASSWORD);
  // Approval POST routes are zero-trust mapped for super_admin only today; distinct super admins satisfy 2-of-2 without self-approval.
  await upsertAdmin(CHECKER_A_ID, 'cert_checker_a@cert.local', 'super_admin', 'Cert Checker A', CERT_PASSWORD);
  await upsertAdmin(CHECKER_B_ID, 'cert_checker_b@cert.local', 'super_admin', 'Cert Checker B', CERT_PASSWORD);
  await upsertAdmin('55555555-5555-4555-8555-555555555555', 'cert_support@cert.local', 'support', 'Cert Support', CERT_PASSWORD);
  await upsertAdmin('66666666-6666-4666-8666-666666666666', 'cert_risk@cert.local', 'risk_manager', 'Cert Risk', CERT_PASSWORD);
  await upsertAdmin(
    FOREX_ONLY_ID,
    'cert_forex@cert.local',
    'dealer',
    'Cert Forex Only',
    CERT_PASSWORD,
    CERT_FOREX_ONLY_UI_PERMISSIONS,
  );
  await upsertAdmin(CONTROL_ONLY_ID, 'cert_control@cert.local', 'kyc_reviewer', 'Cert Control Only', CERT_PASSWORD);
  await upsertAdmin(
    WITHDRAWAL_APPROVER_ID,
    'cert_withdrawal@cert.local',
    'withdrawal_approver',
    'Cert Withdrawal Approver',
    CERT_PASSWORD,
  );

  await db.query(
    `INSERT INTO forex_crm_tasks (task_id, title, status, task_type, due_at, created_by_admin_id)
     VALUES (gen_random_uuid(), 'CERT_overdue_task', 'open', 'FOLLOW_UP', NOW() - INTERVAL '2 days', $1::uuid)`,
    [MAKER_ID],
  );

  console.log(
    JSON.stringify({
      ok: true,
      database: dbName,
      admins: [
        'cert_maker@cert.local',
        'cert_support@cert.local',
        'cert_forex@cert.local',
        'cert_control@cert.local',
        'cert_withdrawal@cert.local',
        'cert_checker_a@cert.local',
        'cert_checker_b@cert.local',
        'cert_risk@cert.local',
      ],
      trader: 'cert_trader_b@cert.local',
      accounts: ['CERT_ACC_A', 'CERT_ACC_B'],
      note: 'Cert-only passwords via FOREX_CERT_ADMIN_PASSWORD / FOREX_CERT_TRADER_PASSWORD or defaults CertAdmin1! / CertTrader1!',
    }),
  );
  await db.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
