# Release Checklist — METHErium Mobile v1.0.0

**Engineering baseline:** Phase 7.6 freeze · **App version:** 1.0.0

---

## 1. Code gates (required)

- [ ] Typecheck pass
- [ ] ESLint 0 errors
- [ ] Unit tests 225/225 pass
- [ ] Architecture validation pass
- [ ] No uncommitted production code changes outside Phase 8 UI scope

---

## 2. Build artifacts

- [ ] iOS Release build succeeds (`expo run:ios --configuration Release`)
- [ ] Android Release build succeeds (when SDK available)
- [ ] Bundle ID: `com.metheorium.mobile`
- [ ] Deep link scheme: `metheorium://`
- [ ] Universal links: `https://app.metheorium.com`

---

## 3. QA automation

- [ ] `npm run qa:matrix:ios` — Release deep-link matrix pass
- [ ] `npm run qa:smoke:dev` — 8/8 dev-client smokes pass (with Metro)
- [ ] Multi-device matrix executed or gaps documented

---

## 4. Security & compliance

- [ ] Guest guards verified (deposit, withdraw, protected routes)
- [ ] Session expiry / logout cleanup verified (manual or unit)
- [ ] App lock / biometrics tested on physical device
- [ ] No secrets in repo (.env excluded)
- [ ] Permission strings present in `app.config.ts` (camera, Face ID, photos)

---

## 5. Store readiness (pre-submission)

- [ ] App icons and splash assets final (Phase 8)
- [ ] Privacy policy / legal URLs reachable
- [ ] Version and build number incremented
- [ ] EAS / App Store Connect metadata prepared

---

## 6. Sign-off

| Role | Name | Date | GO/NO-GO |
|------|------|------|----------|
| Engineering | | | |
| QA | | | |
| Product | | | |

---

## Rollback reference

See `ROLLBACK-PROCEDURE.md`.

## Known limitations

See `KNOWN-LIMITATIONS.md`.
