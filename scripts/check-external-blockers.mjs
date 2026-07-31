#!/usr/bin/env node
/**
 * Detect release blockers that require external configuration (not fixable in repo code).
 */
import { execSync } from 'node:child_process';

function psql(sql) {
  const oneLine = sql.replace(/\s+/g, ' ').trim();
  return execSync(
    `docker exec exchange-postgres psql -U exchange -d exchange -t -A -c ${JSON.stringify(oneLine)}`,
    { encoding: 'utf8' },
  ).trim();
}

const blockers = [];

try {
  const provider = psql(
    `SELECT COALESCE((SELECT value::text FROM system_settings WHERE key='SANCTIONS_PROVIDER' LIMIT 1), '')`,
  ).replace(/"/g, '');
  const amlActive = psql(
    `SELECT COUNT(*)::text FROM api_settings WHERE category='aml' AND is_active=true AND (COALESCE(api_key,'')<>'' OR COALESCE(api_secret,'')<>'')`,
  );
  const envKey = (process.env.SANCTIONS_API_KEY ?? '').trim();
  const hasKey = amlActive !== '0' || envKey.length > 0;
  const placeholder = !provider || ['noop', 'none', 'mock', 'disabled'].includes(provider.toLowerCase());
  if (placeholder || !hasKey) {
    blockers.push({
      id: 'SANCTIONS_API_KEY',
      category: 'EXTERNAL_DEPENDENCY',
      missing: 'Active AML provider with valid SANCTIONS_API_KEY (Admin Integrations or env)',
      provider: 'Compliance / Ops',
      reason: 'Tier-1 fail-closed in production; cannot bypass without real screening credentials',
    });
  }
} catch (e) {
  blockers.push({
    id: 'SANCTIONS_CHECK_ERROR',
    category: 'ENVIRONMENT',
    missing: 'Postgres reachable for sanctions config check',
    provider: 'Ops',
    reason: e instanceof Error ? e.message : String(e),
  });
}

if ((process.env.ADMIN_2FA_MANDATORY ?? 'false').toLowerCase() === 'false') {
  blockers.push({
    id: 'ADMIN_2FA_MANDATORY',
    category: 'CONFIGURATION',
    missing: 'ADMIN_2FA_MANDATORY=true and admin TOTP enrollment',
    provider: 'Security / Ops',
    reason: 'Step-up and maker-checker hardening require 2FA in production',
  });
}

if (!(process.env.ALERT_WEBHOOK_URL ?? '').trim()) {
  blockers.push({
    id: 'ALERT_WEBHOOK_URL',
    category: 'EXTERNAL_DEPENDENCY',
    missing: 'ALERT_WEBHOOK_URL (Slack/PagerDuty)',
    provider: 'SRE / Ops',
    reason: 'Alert dispatch endpoint is deployment-specific',
  });
}

const out = {
  checkedAt: new Date().toISOString(),
  externalBlockers: blockers.filter((b) => b.category === 'EXTERNAL_DEPENDENCY'),
  configBlockers: blockers.filter((b) => b.category === 'CONFIGURATION'),
  environmentBlockers: blockers.filter((b) => b.category === 'ENVIRONMENT'),
  all: blockers,
  p2pCertifiable: !blockers.some((b) => b.id === 'SANCTIONS_API_KEY'),
};

console.log(JSON.stringify(out, null, 2));
