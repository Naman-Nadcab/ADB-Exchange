#!/bin/sh
# Fast-forward the production checkout and reload nginx so /admin stays on the
# upstream URI. Does not build or recreate containers.
set -eu

APP=${NGINX_APP:-/opt/adb-exchange}
EXPECTED=${NGINX_EXPECTED:-}
RELEASE=${NGINX_RELEASE:-}
BUNDLE=${NGINX_BUNDLE:-/tmp/nginx-admin-path.bundle}

if [ -z "$EXPECTED" ] || [ -z "$RELEASE" ]; then
  echo "SHA_INPUT_MISSING" >&2
  exit 1
fi

cd "$APP"
if [ ! -f docker-compose.production.yml ] || [ ! -d nginx ] || [ ! -d .git ]; then
  echo "APP_PATH_INVALID" >&2
  exit 1
fi

stamp() {
  name=$1
  if docker inspect "$name" >/dev/null 2>&1; then
    docker inspect -f "$name status={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} started={{.State.StartedAt}} image={{.Image}}" "$name"
  else
    echo "$name MISSING"
  fi
}

record_runtime() {
  stamp exchange-frontend
  stamp exchange-backend
  stamp exchange-postgres
  stamp exchange-redis
  stamp exchange-nats
  stamp exchange-matching-engine
  stamp exchange-admin
  stamp exchange-nginx
  stamp exchange-indexer
  stamp exchange-rabbitmq
}

apply_nginx_files() {
  # Git replaces the host file inode. The container's file bind keeps the old inode,
  # so copy the checkout bytes in instead of reading the mounted file.
  docker exec -i exchange-nginx sh -c 'cat > /etc/nginx/nginx.conf.new' < nginx/nginx.tls.conf
  if docker exec exchange-nginx sh -c 'test -s /etc/nginx/conf.d/wallet-browser.conf'; then
    docker exec -i exchange-nginx sh -c 'cat > /etc/nginx/wallet-browser.conf.new' < nginx/nginx.wallet-browser.conf
  fi
  docker exec exchange-nginx sh -c '
    set -eu
    cp /etc/nginx/nginx.conf.new /etc/nginx/nginx.conf
    if [ -f /etc/nginx/wallet-browser.conf.new ]; then
      cp /etc/nginx/wallet-browser.conf.new /etc/nginx/conf.d/wallet-browser.conf
    fi
    nginx -t
  '
}

rollback() {
  echo "NGINX_ROLLBACK" >&2
  git reset --hard "$EXPECTED"
  apply_nginx_files
  docker exec exchange-nginx nginx -s reload
}

if [ -n "$(git status --porcelain)" ]; then
  echo "PRODUCTION_TREE_DIRTY" >&2
  exit 1
fi

head=$(git rev-parse HEAD)
echo "PRODUCTION_HEAD=$head"
if [ "$head" != "$EXPECTED" ]; then
  echo "HEAD_MISMATCH expected=$EXPECTED actual=$head" >&2
  exit 1
fi

if [ ! -f "$BUNDLE" ]; then
  echo "BUNDLE_MISSING" >&2
  exit 1
fi
git bundle verify "$BUNDLE" >/dev/null
tip=$(git bundle list-heads "$BUNDLE" | awk 'NR==1 { print $1 }')
if [ "$tip" != "$RELEASE" ]; then
  echo "BUNDLE_TIP_MISMATCH tip=$tip release=$RELEASE" >&2
  exit 1
fi

before=$(mktemp)
record_runtime >"$before"
cat "$before"

git fetch "$BUNDLE" refs/nginx-admin-path/release
git merge --ff-only "$RELEASE"
if [ "$(git rev-parse HEAD)" != "$RELEASE" ]; then
  echo "HEAD_AFTER_MERGE_MISMATCH" >&2
  git reset --hard "$EXPECTED"
  exit 1
fi

disallowed=$(git diff --name-only "$EXPECTED" HEAD | grep -vx -e 'nginx/nginx.conf' -e 'nginx/nginx.http-only.conf' -e 'nginx/nginx.tls.conf' -e 'nginx/nginx.wallet-browser.conf' -e '.github/workflows/reload-nginx-admin-path.yml' -e 'deployment/nginx-admin-path-remote.sh' || true)
if [ -n "$disallowed" ]; then
  echo "SERVER_DIFF_NOT_NGINX_ONLY" >&2
  printf '%s\n' "$disallowed" >&2
  git reset --hard "$EXPECTED"
  exit 1
fi

if ! grep -q 'proxy_pass http://$upstream_host:3001;' nginx/nginx.tls.conf; then
  echo "TLS_CONF_MISSING_KEEP_PREFIX" >&2
  git reset --hard "$EXPECTED"
  exit 1
fi
if grep -q 'proxy_pass http://$upstream_host:3001/;' nginx/nginx.tls.conf; then
  echo "TLS_CONF_STILL_STRIPS" >&2
  git reset --hard "$EXPECTED"
  exit 1
fi

if ! apply_nginx_files; then
  echo "NGINX_TEST_FAILED" >&2
  rollback
  exit 1
fi

if ! docker exec exchange-nginx nginx -s reload; then
  echo "NGINX_RELOAD_FAILED" >&2
  rollback
  exit 1
fi

if docker exec exchange-nginx grep -q 'proxy_pass http://$upstream_host:3001/;' /etc/nginx/nginx.conf; then
  echo "RUNNING_CONF_STILL_STRIPS" >&2
  rollback
  exit 1
fi
if ! docker exec exchange-nginx grep -q 'proxy_pass http://$upstream_host:3001;' /etc/nginx/nginx.conf; then
  echo "RUNNING_CONF_MISSING_KEEP_PREFIX" >&2
  rollback
  exit 1
fi

html=$(curl -kfsS --max-time 20 https://127.0.0.1/admin/login)
printf '%s' "$html" | grep -q 'admin-login-shell'
printf '%s' "$html" | grep -q 'id="email"'
if printf '%s' "$html" | grep -q '__next_error__'; then
  echo "ADMIN_STILL_ERROR_PAGE" >&2
  rollback
  exit 1
fi
css=$(printf '%s' "$html" | sed -n 's/.*\(\/admin\/_next\/static\/css\/[A-Za-z0-9._-]*\.css\).*/\1/p' | head -n 1)
js=$(printf '%s' "$html" | sed -n 's/.*\(\/admin\/_next\/static\/chunks\/[A-Za-z0-9._-]*\.js\).*/\1/p' | head -n 1)
if [ -z "$css" ] || [ -z "$js" ]; then
  echo "ADMIN_ASSETS_MISSING" >&2
  rollback
  exit 1
fi
css_type=$(curl -kfsS -o /dev/null -D - --max-time 20 "https://127.0.0.1$css" | awk 'BEGIN{IGNORECASE=1} /^content-type:/ { print $2; exit }')
js_type=$(curl -kfsS -o /dev/null -D - --max-time 20 "https://127.0.0.1$js" | awk 'BEGIN{IGNORECASE=1} /^content-type:/ { print $2; exit }')
echo "ADMIN_CSS=$css type=$css_type"
echo "ADMIN_JS=$js type=$js_type"
printf '%s' "$css_type" | grep -q 'text/css'
printf '%s' "$js_type" | grep -q 'javascript'
curl -kfsS --max-time 20 https://127.0.0.1/health | grep -q '"status":"healthy"'
markets=$(curl -kfsS -o /dev/null -w '%{http_code}' --max-time 20 https://127.0.0.1/forex/markets)
echo "MARKETS_HTTP=$markets"
test "$markets" = "200"

after=$(mktemp)
record_runtime >"$after"
for name in exchange-frontend exchange-backend exchange-postgres exchange-redis exchange-nats exchange-matching-engine exchange-admin exchange-nginx exchange-indexer exchange-rabbitmq; do
  old=$(grep "^$name " "$before" || true)
  new=$(grep "^$name " "$after" || true)
  if [ "$old" != "$new" ]; then
    echo "UNRELATED_CONTAINER_CHANGED $name" >&2
    echo "BEFORE $old" >&2
    echo "AFTER $new" >&2
    rollback
    rm -f "$before" "$after"
    exit 1
  fi
done
rm -f "$before" "$after"
echo "NGINX_ADMIN_PATH_OK"
echo "RELEASE_HEAD=$(git rev-parse HEAD)"
