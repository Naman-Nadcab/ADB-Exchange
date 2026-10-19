#!/bin/sh
# One production admin sign-in. Prints the seeded email and password.
# Does not print the encryption key, the TOTP secret, or session tokens.
set -eu
cd "${APP:-/opt/adb-exchange}"
test -f .env

read_env() {
  raw=$(grep -E "^$1=" .env | head -n 1 | cut -d= -f2- | tr -d '\r')
  raw=${raw#\"}
  raw=${raw%\"}
  raw=${raw#\'}
  raw=${raw%\'}
  printf '%s' "$raw"
}

cleanup() {
  rm -f /tmp/admin-enc-key /tmp/admin-enc-secret /tmp/admin-totp-in.json \
    /tmp/admin-totp.js /tmp/admin-login.json /tmp/admin-token /tmp/admin-api.json \
    /tmp/admin-page.html
}
trap cleanup EXIT

ADMIN_EMAIL=$(read_env INITIAL_ADMIN_EMAIL)
ADMIN_PASSWORD=$(read_env INITIAL_ADMIN_PASSWORD)
ENC_KEY=$(read_env ENCRYPTION_KEY)
echo "ADMIN_EMAIL=$ADMIN_EMAIL"
echo "ADMIN_PASSWORD=$ADMIN_PASSWORD"
echo "ADMIN_2FA_FLAG=$(read_env ADMIN_2FA_MANDATORY)"
if [ -n "$ENC_KEY" ]; then echo "ENC_KEY_SET=yes"; else echo "ENC_KEY_SET=no"; fi

case "$ADMIN_EMAIL" in
  ''|*[!A-Za-z0-9._%+-@]*) echo "ADMIN_EMAIL_UNSAFE" >&2; exit 0 ;;
esac
printf '%s' "$ADMIN_EMAIL" | grep -q '@' || { echo "ADMIN_EMAIL_UNSAFE" >&2; exit 0; }

docker exec exchange-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email, role, is_active, two_factor_enabled, failed_login_attempts, locked_until FROM admin_users ORDER BY email"' || \
  docker exec exchange-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT email, role, is_active FROM admin_users ORDER BY email"'

row=$(docker exec -i exchange-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -v ON_ERROR_STOP=1' <<SQL
SELECT COALESCE(role, '') || '|' ||
       COALESCE(is_active::text, '') || '|' ||
       COALESCE(two_factor_enabled::text, 'false') || '|' ||
       COALESCE(failed_login_attempts::text, '0') || '|' ||
       CASE WHEN locked_until IS NOT NULL AND locked_until > NOW() THEN 'locked' ELSE 'open' END
FROM admin_users
WHERE lower(email) = lower('${ADMIN_EMAIL}');
SQL
)
row=$(printf '%s' "$row" | tr -d '[:space:]')
echo "ADMIN_ROW=$row"
if [ -z "$row" ]; then
  echo "ADMIN_ROW_MISSING"
  exit 0
fi

role=$(printf '%s' "$row" | cut -d'|' -f1)
active=$(printf '%s' "$row" | cut -d'|' -f2)
tfa=$(printf '%s' "$row" | cut -d'|' -f3)
attempts=$(printf '%s' "$row" | cut -d'|' -f4)
lock=$(printf '%s' "$row" | cut -d'|' -f5)
echo "ADMIN_ROLE=$role"
echo "ADMIN_ACTIVE=$active"
echo "ADMIN_2FA=$tfa"
echo "ADMIN_ATTEMPTS=$attempts"
echo "ADMIN_LOCK=$lock"

if [ "$lock" = "locked" ]; then
  echo "LOGIN_SKIPPED=account_locked"
  exit 0
fi

ADMIN_CODE=""
if [ "$tfa" = "true" ] || [ "$tfa" = "t" ]; then
  enc=$(docker exec -i exchange-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -t -A -v ON_ERROR_STOP=1' <<SQL
SELECT COALESCE(two_factor_secret, '')
FROM admin_users
WHERE lower(email) = lower('${ADMIN_EMAIL}');
SQL
)
  enc=$(printf '%s' "$enc" | tr -d '[:space:]')
  umask 077
  printf '%s' "$ENC_KEY" > /tmp/admin-enc-key
  printf '%s' "$enc" > /tmp/admin-enc-secret
  cat > /tmp/admin-totp.js << 'NODE'
const crypto = require('crypto');
const fs = require('fs');
try {
  const key = fs.readFileSync('/tmp/admin-enc-key', 'utf8');
  const enc = fs.readFileSync('/tmp/admin-enc-secret', 'utf8').trim();
  const parts = enc.split(':');
  if (parts.length !== 3 || !key) throw new Error('format');
  const keyBuf = crypto.createHash('sha256').update(key).digest();
  const iv = Buffer.from(parts[0], 'base64');
  const tag = Buffer.from(parts[1], 'base64');
  const ct = Buffer.from(parts[2], 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(tag);
  const base32 = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = base32.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];
  for (const char of cleaned) {
    const idx = alphabet.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  const secret = Buffer.from(output);
  const counter = Math.floor(Date.now() / 1000 / 30);
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', secret).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  const code = (binary % 1000000).toString().padStart(6, '0');
  if (!/^[0-9]{6}$/.test(code)) throw new Error('code');
  process.stdout.write(code);
} catch (e) {
  process.stderr.write('totp decrypt failed\n');
  process.stdout.write('TOTP_FAIL');
}
NODE
  docker exec -i exchange-backend sh -c 'cat > /tmp/admin-enc-key' < /tmp/admin-enc-key
  docker exec -i exchange-backend sh -c 'cat > /tmp/admin-enc-secret' < /tmp/admin-enc-secret
  docker exec -i exchange-backend sh -c 'cat > /tmp/admin-totp.js' < /tmp/admin-totp.js
  ADMIN_CODE=$(docker exec exchange-backend node /tmp/admin-totp.js || true)
  docker exec exchange-backend rm -f /tmp/admin-enc-key /tmp/admin-enc-secret /tmp/admin-totp.js || true
  rm -f /tmp/admin-enc-key /tmp/admin-enc-secret /tmp/admin-totp.js
  case "$ADMIN_CODE" in
    [0-9][0-9][0-9][0-9][0-9][0-9]) echo "TOTP_READY=yes" ;;
    *) echo "TOTP_READY=no"; ADMIN_CODE="" ;;
  esac
fi

export ADMIN_EMAIL ADMIN_PASSWORD ADMIN_CODE
body=$(python3 -c 'import json,os
p={"email":os.environ["ADMIN_EMAIL"],"password":os.environ["ADMIN_PASSWORD"]}
c=os.environ.get("ADMIN_CODE","").strip()
if len(c)==6 and c.isdigit():
    p["twofa_code"]=c
print(json.dumps(p))')
code=$(curl -k -sS -o /tmp/admin-login.json -w '%{http_code}' --max-time 25 \
  -X POST https://127.0.0.1/api/v1/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d "$body" || true)
echo "LOGIN_HTTP=$code"
python3 -c 'import json
raw=open("/tmp/admin-login.json").read()
data=json.loads(raw)
d=data.get("data") if isinstance(data, dict) else None
token=""
if isinstance(d, dict):
    token=d.pop("accessToken", "") or ""
    d.pop("refreshToken", None)
    admin=d.get("admin") if isinstance(d.get("admin"), dict) else None
    if isinstance(admin, dict):
        admin.pop("id", None)
        admin.pop("permissions", None)
open("/tmp/admin-token","w").write(token)
print("LOGIN_BODY="+json.dumps(data)[:1500])'
token=$(cat /tmp/admin-token 2>/dev/null || true)
rm -f /tmp/admin-login.json /tmp/admin-token
if [ -z "$token" ]; then
  echo "LOGIN_NO_SESSION"
else
  echo "LOGIN_SESSION=yes"
  for path in \
    /api/v1/admin/dashboard-summary \
    /api/v1/admin/dashboard/stats \
    /api/v1/admin/forex/overview \
    /api/v1/admin/users?limit=5 \
    /api/v1/admin/wallets?limit=5 \
    /api/v1/admin/funds/summary \
    /api/v1/admin/settings \
    /api/v1/admin/kyc?limit=5 \
    /api/v1/admin/trading \
    /api/v1/admin/settings/trading-pairs
  do
    c=$(curl -k -sS -o /tmp/admin-api.json -w '%{http_code}' --max-time 25 \
      -H "Authorization: Bearer $token" "https://127.0.0.1$path" || true)
    echo "API $path HTTP=$c"
    python3 -c 'import json
raw=open("/tmp/admin-api.json").read()
try:
    data=json.loads(raw)
except Exception:
    print("shape=not_json bytes="+str(len(raw)))
    raise SystemExit
err=""
if isinstance(data, dict) and isinstance(data.get("error"), dict):
    err=str(data["error"].get("code") or "")
inner=data.get("data") if isinstance(data, dict) else None
keys=""
extra=""
if isinstance(inner, dict):
    keys=",".join(list(inner)[:16])
    for k,v in inner.items():
        if isinstance(v, bool):
            extra += " "+k+"="+("true" if v else "false")
        elif isinstance(v, (int, float)) and not isinstance(v, bool):
            extra += " "+k+"="+str(v)
        elif isinstance(v, list):
            extra += " "+k+"_len="+str(len(v))
        elif isinstance(v, dict):
            extra += " "+k+"_keys="+str(len(v))
elif isinstance(inner, list):
    extra=" len="+str(len(inner))
success=data.get("success") if isinstance(data, dict) else ""
print("shape success="+str(success)+" error="+err+" keys="+keys+extra)
'
  done
  curl -k -sS -o /dev/null --max-time 15 \
    -X POST https://127.0.0.1/api/v1/admin/auth/logout \
    -H "Authorization: Bearer $token" || true
  echo "LOGIN_LOGGED_OUT=yes"
fi

for path in /admin/login /admin/control-center /admin/dashboard /admin/users /admin/wallets /admin/forex/accounts; do
  c=$(curl -k -sS -o /tmp/admin-page.html -w '%{http_code}' --max-time 20 "https://127.0.0.1$path" || true)
  bytes=$(wc -c < /tmp/admin-page.html | tr -d ' ')
  err=no
  if grep -q '__next_error__' /tmp/admin-page.html; then err=yes; fi
  echo "PAGE $path HTTP=$c bytes=$bytes next_error=$err"
done

echo "ADMIN_CHECK_DONE"
