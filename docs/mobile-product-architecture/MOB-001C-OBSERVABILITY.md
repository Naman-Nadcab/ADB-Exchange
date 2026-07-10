# MOB-001C — Observability Architecture

**Status:** FROZEN

---

## 1. Logging

| Level | Dev | Prod |
|-------|-----|------|
| debug | console | off |
| info | console | sampled 1% |
| warn | console + Sentry | Sentry |
| error | console + Sentry | Sentry |

`core/observability/logger.ts` — structured JSON:

```json
{ "level", "msg", "requestId", "screenId", "userIdHash", "ts" }
```

---

## 2. Analytics

| Provider | MVP | Events |
|----------|-----|--------|
| Firebase Analytics or Amplitude | One chosen Sprint 0 | Per MOB-001B screen `analytics` field |

**Standard events:**

- `screen_view_{id}`
- `order_placed`, `order_failed`
- `deposit_address_copied`
- `withdraw_submitted`
- `p2p_order_created`
- `kyc_started`, `kyc_completed`
- `signup_completed`, `login_completed`

**No PII** in event properties — userId hashed.

---

## 3. Crash Reporting

- **Sentry** `@sentry/react-native`
- Source maps uploaded EAS build
- Breadcrumbs: navigation, API status (no bodies)

---

## 4. Performance Monitoring

- Sentry transactions: cold start, trade load, withdraw flow
- WS reconnect count metric
- API latency histogram client-side

---

## 5. Network Monitoring

- Dev: Flipper / Reactotron optional
- Prod: Sentry failed request capture
- Health check poll `/health` every 5m foreground → maintenance S-002

---

## 6. Feature Flags

| Source | MVP |
|--------|-----|
| Remote config | **OFF** — backend feature flags admin-only |
| Local build flags | `EXPO_PUBLIC_FEATURE_P2P_UI=true` |

P2P UI always built; M-600 when API sanctions block.

---

## 7. Debug vs Production

| Capability | Debug | Prod |
|------------|-------|------|
| Reactotron | optional | off |
| API logging bodies | on | off |
| WS message log | on | off |
| Dev menu shake | on | off |
| Certificate pinning | off | on |

`__DEV__` gates.

---

## 8. Audit Events (client)

Security actions logged analytics + optional backend `/user/activity` already exists:

- login, logout, 2fa_enable, withdraw_initiated, api_key_created

---

## 9. Telemetry Privacy

- GDPR-style consent S-121 push
- Analytics opt-out in S-740 preferences (local flag disables dispatch)

---

## 10. Alerting (ops)

Mobile client does not alert ops — Sentry → PagerDuty integration org-level.
