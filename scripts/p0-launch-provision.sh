#!/usr/bin/env bash
# P0-2..P0-5 production config (idempotent). Does not print secrets.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

python3 <<'PY'
import json, os, re, secrets, subprocess, uuid
from pathlib import Path

env_path = Path(".env")
lines = env_path.read_text().splitlines()

def parse_env() -> dict[str, str]:
    out: dict[str, str] = {}
    for line in lines:
        if not line or line.lstrip().startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k] = v
    return out

env = parse_env()

def set_kv(key: str, value: str) -> None:
    global lines
    pat = re.compile(rf"^{re.escape(key)}=")
    found = False
    out = []
    for line in lines:
        if pat.match(line):
            out.append(f"{key}={value}")
            found = True
        else:
            out.append(line)
    if not found:
        out.append(f"{key}={value}")
    lines = out

sanctions_key = env.get("SANCTIONS_API_KEY", "").strip()
set_kv("SANCTIONS_API_URL", "https://public.chainalysis.com/api/v1/address")
if sanctions_key:
    set_kv("SANCTIONS_PROVIDER", "chainalysis")
else:
    set_kv("SANCTIONS_PROVIDER", "noop")

mm_api_key = env.get("LIQUIDITY_BOT_API_KEY", "").strip() or f"mm_live_{secrets.token_hex(16)}"
set_kv("LIQUIDITY_BOT_ENABLED", "true")
set_kv("LIQUIDITY_BOT_API_KEY", mm_api_key)
set_kv("LIQUIDITY_BOT_INTERNAL_API_URL", "http://127.0.0.1:4000/api/v1")
set_kv("OPS_ALERT_EMAIL", env.get("OPS_ALERT_EMAIL", "").strip() or "raj@byom.de")

env_path.write_text("\n".join(lines) + "\n")

smtp_host = env.get("SMTP_HOST", "")
smtp_port = env.get("SMTP_PORT", "465")
smtp_secure = env.get("SMTP_SECURE", "true")
smtp_user = env.get("SMTP_USER", "resend")
smtp_pass = env.get("SMTP_PASSWORD", "").replace("'", "''")
aml_active = "TRUE" if sanctions_key else "FALSE"
aml_secret = sanctions_key.replace("'", "''")

sql = f"""
UPDATE api_settings SET is_active = FALSE WHERE category IN ('email', 'aml');
UPDATE api_settings SET
  is_active = TRUE,
  is_default = TRUE,
  api_url = 'smtp.resend.com',
  api_key = '{smtp_user.replace("'", "''")}',
  api_secret = '{smtp_pass}',
  additional_config = jsonb_build_object(
    'host', '{smtp_host.replace("'", "''")}',
    'port', '{smtp_port}',
    'secure', '{smtp_secure}',
    'from_email', 'noreply@nadcab.com',
    'from_name', 'Metherium Exchange'
  ),
  health_status = 'unknown',
  updated_at = NOW()
WHERE category = 'email' AND provider = 'smtp';

UPDATE api_settings SET
  is_active = {aml_active},
  is_default = TRUE,
  api_url = 'https://public.chainalysis.com/api/v1/address',
  api_secret = NULLIF('{aml_secret}', ''),
  updated_at = NOW()
WHERE category = 'aml' AND provider = 'chainalysis';

INSERT INTO system_settings (key, value, updated_at)
VALUES
  ('SANCTIONS_PROVIDER', to_jsonb('chainalysis'::text), NOW()),
  ('SANCTIONS_API_URL', to_jsonb('https://public.chainalysis.com/api/v1/address'::text), NOW()),
  ('alert_webhook_url', to_jsonb(''::text), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

DELETE FROM user_api_keys WHERE user_id = 'a0000000-0000-4000-8000-00000000aa01'::uuid AND name = 'liquidity_bot_live';
INSERT INTO user_api_keys (
  user_id, name, key_type, api_key_usage, api_key, api_secret, public_key,
  permission, ip_restriction, ip_addresses, permissions
) VALUES (
  'a0000000-0000-4000-8000-00000000aa01'::uuid,
  'liquidity_bot_live',
  'system',
  'transaction',
  '{mm_api_key.replace("'", "''")}',
  NULL,
  NULL,
  'read_write',
  'no_restriction',
  '[]'::jsonb,
  '{{"spot_trading": true, "no_withdraw": true, "no_internal_transfer": true}}'::jsonb
);

INSERT INTO user_balances (user_id, currency_id, chain_id, account_type, available_balance, locked_balance, pending_balance, total_deposited)
VALUES
  ('a0000000-0000-4000-8000-00000000aa01'::uuid, '907838c7-4a27-44a6-88fa-2a6f6882883e'::uuid, '', 'trading', 500000, 0, 0, 500000),
  ('a0000000-0000-4000-8000-00000000aa01'::uuid, 'b3df1064-14d8-4654-8b2b-df4d612fe710'::uuid, '', 'trading', 10, 0, 0, 10),
  ('a0000000-0000-4000-8000-00000000aa01'::uuid, '01f430be-d214-4511-a252-e43aa5709bc9'::uuid, '', 'trading', 50, 0, 0, 50)
ON CONFLICT (user_id, currency_id, chain_id, account_type) DO UPDATE SET
  available_balance = GREATEST(user_balances.available_balance, EXCLUDED.available_balance),
  updated_at = NOW();

UPDATE feature_flags SET status = 'enabled', updated_at = NOW() WHERE feature_key = 'liquidity_bot';
"""

Path("/tmp/p0-provision.sql").write_text(sql)
proc = subprocess.run(
    ["docker", "exec", "-i", "exchange-postgres", "psql", "-U", "exchange", "-d", "exchange", "-v", "ON_ERROR_STOP=1"],
    input=sql.encode(),
    check=True,
)
print(f"provision_ok mm_api_key_len={len(mm_api_key)} sanctions_key_set={bool(sanctions_key)}")
PY
