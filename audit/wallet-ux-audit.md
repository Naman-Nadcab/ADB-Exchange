# Phase 6 — Wallet Experience Audit

**Generated:** 2026-06-22  
**Canonical shell:** `WalletOperationsShell.tsx`, `WalletWithdrawNav.tsx`

---

## Deposit Flow

### Crypto (`/wallet/deposit/crypto`)

| Step | UX | Evidence |
|------|-----|----------|
| 1. Select coin | Search + chips | `deposit/crypto/page.tsx` |
| 2. Select chain | Dropdown, auto-first | |
| 3. Address | QR + copy | Runtime: `hasQR: true`, `hasCopy: true` |
| 4. Wait | Recent deposits table | Polling in history, not on deposit page |

**User understands where funds go:** ✅ Address + network warning shown  
**KYC block:** Modal → `/dashboard/identity`  
**Gap:** No fiat deposit — copy still mentions “Fiat deposit” → help

### Fiat deposit

**Does not exist** — overview/funding pages state INR self-serve not live.

---

## Withdraw Flow

### Hub (`/wallet/withdraw`)

- Crypto vs INR cards — clear
- Hinglish note on bank setup — inconsistent tone

### Crypto (`/wallet/withdraw/crypto`)

| Step | UX |
|------|-----|
| On-chain vs internal tabs | Clear split |
| Review panel | Summary before confirm — **good** |
| 2FA + fund password | Required fields mapped |
| Success | 5s green banner by status |

**Issues:**
- QR scanner = toast stub only
- Token fetch errors silent (`console.error`)
- `?coin=` deep link ignored
- Help FAB dead (no href)

### Fiat (`/wallet/withdraw/fiat`)

- Simpler one-step request
- Banks from P2P payment methods — **confusing** if user never used P2P
- Skeleton loading on balance (`Skeleton` components)

---

## Address Display & QR

| Surface | QR | Copy feedback |
|---------|-----|---------------|
| Deposit | `QRCodeSVG` real | Check icon 2s, no toast |
| Withdraw | Fake scanner toast | Address copy in history |

---

## Transaction History (`/wallet/history`)

| Feature | Status |
|---------|--------|
| Tabs | “All Transactions” + “History” — **redundant naming** |
| Sub-tabs | deposit / withdraw / transfer |
| Filters | coin, status, date |
| Export | CSV/Excel |
| Deposit polling | 3s pending / 5s idle |
| Fiat INR | **Not in this page** — crypto only |

---

## Fee & Confirmation Clarity

| Flow | Fees shown | Confirmations |
|------|------------|---------------|
| Deposit | Network note | In history table (e.g. 3/25) |
| Withdraw crypto | Fee preview debounced | Status badges |
| Withdraw fiat | Not always visible upfront | Admin settlement implied |

---

## Error State (runtime)

Mock `500` on `/wallet/tokens`:
- `crash: false`
- `hasErrorUI: true`
- `white: false`

Screenshot path: deposit error captured in `ux-runtime-results.json`

---

## Screenshots

- `audit/screenshots/deposit-mobile.png`
- `audit/screenshots/quick-wallet-deposit-crypto.png`

---

## Top Wallet UX Problems

1. No fiat deposit but marketed in header (P1)
2. INR history separate from crypto history (P2)
3. Silent withdraw token load failures (P1)
4. Internal transfer vs `/wallet/transfer` naming collision (P2)
5. Recent deposit “Address” column may show sender not deposit address (P2)
