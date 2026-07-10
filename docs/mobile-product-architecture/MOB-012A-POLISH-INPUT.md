# MOB-012A — Polish Input (For MOB-012B)

**Sprint:** MOB-012A — Live Device Visual Certification  
**Date:** 2026-07-10  
**Status:** **INPUT NOT AVAILABLE FROM LIVE OBSERVATION**  
**Purpose:** Sole authorized input for MOB-012B polish sprint

---

## 1. Critical Notice

MOB-012A **did not observe the running application** on any device or simulator. Therefore:

- **No live-confirmed polish items** can be issued from MOB-012A
- **MOB-012B must NOT start** until MOB-012A re-run completes with screenshot/video evidence
- MOB-011 polish backlog (`MOB-011-POLISH-BACKLOG.md`) remains **provisional** — it was derived from static code review, **not** live device observation, and is **disqualified** as MOB-012B input per mission rules

---

## 2. What MOB-012B Requires as Input

MOB-012B may only consume polish items that are **confirmed on device** with screenshot or video reference. Each item must include:

| Field | Required |
|-------|----------|
| Screen ID | Yes |
| Live observation description | Yes |
| Screenshot or video ID | Yes |
| Severity (from live impact) | Yes |
| Device(s) where observed | Yes |
| Light and/or dark | Yes |

**Current count of live-confirmed items: 0**

---

## 3. Re-Run Capture Protocol (Generates Valid MOB-012B Input)

When MOB-012A is re-executed on devices, capture the following **observation checkpoints**. Any failure at these checkpoints becomes a valid MOB-012B polish input item.

### 3.1 Global Chrome

| Checkpoint | What to observe | Becomes polish input if… |
|------------|---------------|--------------------------|
| CP-G01 | Bottom tab bar appearance | No icons, wrong tint, badge missing |
| CP-G02 | Status bar contrast | Illegible in light or dark |
| CP-G03 | Safe area on notch/DI/SE | Content under notch or home indicator |
| CP-G04 | Account modal presentation | Jarring transition, no header |
| CP-G05 | Alert dialog vs toast | Blocking alert on copy success |

### 3.2 Authentication

| Checkpoint | Screen | What to observe |
|------------|--------|-----------------|
| CP-A01 | S-100 | Welcome visual impact vs Tier-1 |
| CP-A02 | S-104, S-107 | OTP keyboard + cell UX |
| CP-A03 | S-103 | Password keyboard overlap |
| CP-A04 | Auth flow | Error banner timing and placement |

### 3.3 Markets & Trading

| Checkpoint | Screen | What to observe |
|------------|--------|-----------------|
| CP-M01 | S-200 | List scroll FPS with 100+ pairs |
| CP-M02 | S-200 | Pull-refresh indicator + timing |
| CP-M03 | S-300 | Chart render + interval switch latency |
| CP-M04 | S-300 | Orderbook scroll + tap-to-fill |
| CP-M05 | S-300 | Buy/sell affordance clarity |
| CP-M06 | S-300 | Order form keyboard overlap |
| CP-M07 | S-300 | Fee/estimate visibility before submit |
| CP-M08 | S-302 | Landscape chart usability |

### 3.4 Wallet

| Checkpoint | Screen | What to observe |
|------------|--------|-----------------|
| CP-W01 | S-500 | Portfolio header hierarchy |
| CP-W02 | S-500 | Allocation chart legibility |
| CP-W03 | S-512 | QR card in dark mode |
| CP-W04 | S-512 | Copy feedback (alert vs toast) |
| CP-W05 | S-521–522 | Withdraw wizard step clarity |
| CP-W06 | S-513+ | History row density + date grouping |

### 3.5 P2P

| Checkpoint | Screen | What to observe |
|------------|--------|-----------------|
| CP-P01 | S-600 | Filter modal dark mode |
| CP-P02 | S-600 | Empty marketplace state |
| CP-P03 | S-600 | Merchant trust at a glance |
| CP-P04 | S-610 | Chat scroll + keyboard |
| CP-P05 | S-610 | Escrow timeline clarity |
| CP-P06 | S-610 | Release confirm dialog UX |
| CP-P07 | S-610 | Payment proof modal usability |

### 3.6 Account

| Checkpoint | Screen | What to observe |
|------------|--------|-----------------|
| CP-C01 | S-700 | Account hub identity presentation |
| CP-C02 | S-710 | Security score visual trust |
| CP-C03 | S-712 | 2FA QR vs secret text |
| CP-C04 | S-730 | KYC status stepper |
| CP-C05 | S-740 | Theme toggle + persistence |
| CP-C06 | S-772 | Notification list density |
| CP-C07 | S-764 | Ticket thread readability |

### 3.7 Accessibility (Device)

| Checkpoint | What to observe |
|------------|-----------------|
| CP-X01 | VoiceOver focus order on S-300 |
| CP-X02 | TalkBack on S-500 |
| CP-X03 | Dynamic Type at largest size on S-200 |
| CP-X04 | Contrast ratio on orderbook text |
| CP-X05 | 44pt touch targets on P2P ad cards |

### 3.8 Performance (Visible)

| Checkpoint | Video ID | What to observe |
|------------|----------|-----------------|
| CP-F01 | VID-002 | Markets list scroll jank |
| CP-F02 | VID-003 | Chart update stutter |
| CP-F03 | VID-003 | Orderbook WS refresh flicker |
| CP-F04 | VID-009 | Chat message append lag |
| CP-F05 | VID-011 | Tab switch animation drop |

---

## 4. Observation Log Template (For Re-Run)

Use this template per checkpoint. Only completed rows become MOB-012B input.

```markdown
### [CP-xxx] {Title}
- **Screen ID:** S-xxx
- **Device:** {e.g. Pixel 7 / Android 14}
- **Theme:** light | dark
- **Screenshot:** qa/mob-012a/screenshots/...
- **Video:** qa/mob-012a/videos/... (if motion-related)
- **Observed behaviour:** {factual description only}
- **Tier-1 benchmark gap:** {vs Binance/Bybit/OKX interaction quality}
- **Severity:** Critical | High | Medium | Low | Cosmetic
- **MOB-012B candidate:** YES | NO
```

---

## 5. Provisional Hypotheses (NOT MOB-012B Input)

The following items were flagged in MOB-011 static audit and **must be confirmed or rejected on device** before MOB-012B. They are listed here as **re-run priorities only**, not as approved polish work.

| Hypothesis ID | Screen | Static finding | Confirm on device |
|---------------|--------|----------------|-------------------|
| HYP-001 | S-600 | Filter modal `#fff` breaks dark | Screenshot dark mode |
| HYP-002 | S-512 | QR white box surround | Screenshot dark mode |
| HYP-003 | Main tabs | No icons/badges | Screenshot all tabs |
| HYP-004 | S-300 | Buy/sell not color-coded | Screenshot order form |
| HYP-005 | S-710 | Security score plain text | Screenshot security hub |
| HYP-006 | S-512 | Copy uses Alert not toast | Video copy flow |
| HYP-007 | S-300 | Keyboard overlaps form | Video + keyboard screenshot |
| HYP-008 | S-610 | Chat keyboard overlap | Video order room |

**These hypotheses do not authorize MOB-012B work until confirmed live.**

---

## 6. MOB-012B Authorization Gate

MOB-012B may begin **only when ALL** conditions are met:

| # | Condition | Current |
|---|-----------|---------|
| 1 | MOB-012A verdict = Tier-1 Visual Certified | ❌ NOT Certified |
| 2 | Screenshot index ≥ 95% screens (light + dark) | ❌ 0% |
| 3 | Video index ≥ 10 critical flows | ❌ 0% |
| 4 | VoiceOver + TalkBack on 10 screens documented | ❌ |
| 5 | `MOB-012A-POLISH-INPUT.md` updated with live-confirmed items | ❌ |
| 6 | Per-screen live scores in FINAL-SCORE | ❌ N/A |

---

## 7. Summary

| Item | Count |
|------|-------|
| Live-confirmed polish inputs | **0** |
| Provisional hypotheses (unconfirmed) | 8 |
| MOB-012B authorized | **NO** |

**MOB-012A polish input is empty. Re-run on devices required.**
