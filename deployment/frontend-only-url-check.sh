#!/bin/sh
# Classify frontend API URL settings without printing secrets.
# Success lines are key=value codes. The raw URL, userinfo, path, and query are never printed.
set -eu

edge_host=169.58.39.2

trim() {
  printf '%s' "$1" | tr -d '\r' | sed 's/^[[:space:]]*//; s/[[:space:]]*$//; s/^["'\'']//; s/["'\'']$//'
}

safe_host() {
  host=$1
  case "$host" in
    ''|*[!A-Za-z0-9.-]*|.*|*.|*..*) return 1 ;;
  esac
  return 0
}

classify_assignment() {
  key=$1
  want=$2
  raw=$(grep -E "^(export[[:space:]]+)?${key}[[:space:]]*=" .env 2>/dev/null | head -1 || true)
  strict=$(grep -E "^${key}=" .env 2>/dev/null | head -1 || true)

  if [ -z "$raw" ]; then
    echo "${key}_present=no"
    echo "${key}_legacy_reason=missing"
    echo "${key}_ok=no"
    return 1
  fi
  echo "${key}_present=yes"
  case "$raw" in
    export[[:space:]]*) echo "${key}_export_prefix=yes" ;;
    *) echo "${key}_export_prefix=no" ;;
  esac
  if [ -z "$strict" ]; then
    echo "${key}_strict_assignment=no"
  else
    echo "${key}_strict_assignment=yes"
  fi

  strict_val=$(trim "${strict#*=}")
  raw_val=$(trim "${raw#*=}")
  val=$raw_val
  if [ -n "$strict" ]; then
    legacy=$strict_val
  else
    legacy=
    echo "${key}_legacy_reason=missing_strict_assignment"
  fi

  if [ -z "$val" ]; then
    echo "${key}_reason=empty"
    echo "${key}_ok=no"
    return 1
  fi

  placeholder=no
  printf '%s' "$val" | grep -q 'api.example.com' && placeholder=api.example.com
  printf '%s' "$val" | grep -q 'CHANGE_ME' && placeholder=CHANGE_ME
  printf '%s' "$val" | grep -q 'localhost' && placeholder=localhost
  echo "${key}_placeholder=$placeholder"

  scheme=$(printf '%s' "$val" | sed -n 's|^\([a-z][a-z0-9+.-]*\)://.*|\1|p')
  echo "${key}_scheme=${scheme:-none}"

  if [ -n "$strict" ]; then
    if [ -z "$legacy" ] || printf '%s' "$legacy" | grep -q 'api.example.com\|CHANGE_ME\|localhost'; then
      if [ -z "$legacy" ]; then
        echo "${key}_legacy_reason=empty"
      else
        echo "${key}_legacy_reason=placeholder"
      fi
    else
      case "$legacy" in
        ${want}://*) echo "${key}_legacy_reason=ok" ;;
        *) echo "${key}_legacy_reason=bad_scheme" ;;
      esac
    fi
  fi

  if [ "$placeholder" != "no" ]; then
    echo "${key}_reason=placeholder"
    echo "${key}_ok=no"
    return 1
  fi
  case "$val" in
    ${want}://*) ;;
    *)
      echo "${key}_reason=bad_scheme"
      echo "${key}_ok=no"
      return 1
      ;;
  esac

  rest=${val#*://}
  rest=${rest%%/*}
  rest=${rest%%\?*}
  case "$rest" in
    *@*)
      echo "${key}_userinfo=yes"
      echo "${key}_reason=userinfo"
      echo "${key}_ok=no"
      return 1
      ;;
  esac
  host=${rest%%:*}
  if ! safe_host "$host"; then
    echo "${key}_reason=bad_host"
    echo "${key}_ok=no"
    return 1
  fi
  echo "${key}_host=$host"
  if [ "$host" = "$edge_host" ]; then
    echo "${key}_host_is_production_edge=yes"
  else
    echo "${key}_host_is_production_edge=no"
  fi
  echo "${key}_reason=ok"
  echo "${key}_ok=yes"
  return 0
}

classify_host_value() {
  key=$1
  raw=$(grep -E "^(export[[:space:]]+)?${key}[[:space:]]*=" .env 2>/dev/null | head -1 || true)
  if [ -z "$raw" ]; then
    echo "${key}_present=no"
    return 0
  fi
  echo "${key}_present=yes"
  val=$(trim "${raw#*=}")
  if [ -z "$val" ]; then
    echo "${key}_reason=empty"
    return 0
  fi
  if printf '%s' "$val" | grep -q 'CHANGE_ME\|localhost\|api.example.com'; then
    echo "${key}_reason=placeholder"
    return 0
  fi
  if ! safe_host "$val"; then
    echo "${key}_reason=unsafe_or_not_host"
    return 0
  fi
  echo "${key}_host=$val"
  if [ "$val" = "$edge_host" ]; then
    echo "${key}_host_is_production_edge=yes"
  else
    echo "${key}_host_is_production_edge=no"
  fi
  echo "${key}_reason=ok"
}

classify_baked_value() {
  key=$1
  want=$2
  val=$(trim "$3")
  if [ -z "$val" ]; then
    echo "${key}_present=no"
    return 0
  fi
  echo "${key}_present=yes"
  if printf '%s' "$val" | grep -q 'api.example.com\|CHANGE_ME\|localhost'; then
    echo "${key}_reason=placeholder"
    return 0
  fi
  scheme=$(printf '%s' "$val" | sed -n 's|^\([a-z][a-z0-9+.-]*\)://.*|\1|p')
  echo "${key}_scheme=${scheme:-none}"
  case "$val" in
    ${want}://*) ;;
    *)
      echo "${key}_reason=bad_scheme"
      return 0
      ;;
  esac
  rest=${val#*://}
  rest=${rest%%/*}
  rest=${rest%%\?*}
  case "$rest" in
    *@*) echo "${key}_reason=userinfo"; return 0 ;;
  esac
  host=${rest%%:*}
  if ! safe_host "$host"; then
    echo "${key}_reason=bad_host"
    return 0
  fi
  echo "${key}_host=$host"
  if [ "$host" = "$edge_host" ]; then
    echo "${key}_host_is_production_edge=yes"
  else
    echo "${key}_host_is_production_edge=no"
  fi
  echo "${key}_reason=ok"
}

require_frontend_build_urls() {
  # The browser uses same-origin when the build URL host matches the page host.
  # Nginx terminates TLS for that host, so http/ws to the production edge is valid.
  # Any other host, an empty value, or a placeholder is rejected.
  prod=$(trim "$(grep -E '^(export[[:space:]]+)?PUBLIC_HOST[[:space:]]*=' .env 2>/dev/null | head -1 | sed 's/^[^=]*=//')")
  if [ "$prod" != "$edge_host" ]; then
    echo "PUBLIC_HOST_ok=no"
    echo "PUBLIC_API_URL_ok=no"
    echo "PUBLIC_API_URL_reason=production_host"
    return 1
  fi
  echo "PUBLIC_HOST_ok=yes"

  accept_edge_url() {
    key=$1
    secure=$2
    plain=$3
    raw=$(grep -E "^${key}=" .env 2>/dev/null | head -1 || true)
    if [ -z "$raw" ]; then
      echo "${key}_ok=no"
      echo "${key}_reason=missing"
      return 1
    fi
    val=$(trim "${raw#*=}")
    if [ -z "$val" ]; then
      echo "${key}_ok=no"
      echo "${key}_reason=empty"
      return 1
    fi
    if printf '%s' "$val" | grep -q 'api.example.com\|CHANGE_ME\|localhost'; then
      echo "${key}_ok=no"
      echo "${key}_reason=placeholder"
      return 1
    fi
    scheme=$(printf '%s' "$val" | sed -n 's|^\([a-z][a-z0-9+.-]*\)://.*|\1|p')
    case "$scheme" in
      "$secure"|"$plain") ;;
      *)
        echo "${key}_ok=no"
        echo "${key}_scheme=${scheme:-none}"
        echo "${key}_reason=bad_scheme"
        return 1
        ;;
    esac
    rest=${val#*://}
    rest=${rest%%/*}
    rest=${rest%%\?*}
    case "$rest" in
      *@*)
        echo "${key}_ok=no"
        echo "${key}_reason=userinfo"
        return 1
        ;;
    esac
    host=${rest%%:*}
    port=${rest#"$host"}
    port=${port#:}
    if ! safe_host "$host" || [ "$host" != "$prod" ]; then
      echo "${key}_ok=no"
      echo "${key}_reason=host"
      return 1
    fi
    case "$port" in
      ''|80|443) ;;
      *)
        echo "${key}_ok=no"
        echo "${key}_reason=port"
        return 1
        ;;
    esac
    echo "${key}_scheme=$scheme"
    echo "${key}_host=$host"
    echo "${key}_ok=yes"
    return 0
  }

  ok=0
  accept_edge_url PUBLIC_API_URL https http || ok=1
  accept_edge_url PUBLIC_WS_URL wss ws || ok=1
  return "$ok"
}

report_frontend_urls() {
  classify_assignment PUBLIC_API_URL https || true
  classify_assignment PUBLIC_WS_URL wss || true
  classify_host_value PUBLIC_HOST
  if command -v docker >/dev/null 2>&1; then
    baked=$(docker exec exchange-frontend printenv NEXT_PUBLIC_API_URL 2>/dev/null || true)
    classify_baked_value BAKED_NEXT_PUBLIC_API_URL https "$baked"
    baked_ws=$(docker exec exchange-frontend printenv NEXT_PUBLIC_WS_URL 2>/dev/null || true)
    classify_baked_value BAKED_NEXT_PUBLIC_WS_URL wss "$baked_ws"
    if docker exec exchange-frontend sh -c 'grep -R -q api.example.com /app/.next /app/apps 2>/dev/null'; then
      echo "baked_bundle_example_api=yes"
    else
      echo "baked_bundle_example_api=no"
    fi
    if docker exec exchange-frontend sh -c 'grep -R -q 169.58.39.2 /app/.next /app/apps 2>/dev/null'; then
      echo "baked_bundle_production_edge=yes"
    else
      echo "baked_bundle_production_edge=no"
    fi
    if docker exec exchange-frontend sh -c 'grep -R -q CHANGE_ME /app/.next /app/apps 2>/dev/null'; then
      echo "baked_bundle_change_me=yes"
    else
      echo "baked_bundle_change_me=no"
    fi
  fi
}

if [ "${FRONTEND_ONLY_URL_LIBRARY:-}" != 1 ]; then
  report_frontend_urls
fi
