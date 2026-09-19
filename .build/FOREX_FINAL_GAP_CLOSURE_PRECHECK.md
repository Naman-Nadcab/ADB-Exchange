# Forex final gap closure precheck

Generated: 2026-09-19T16:20:00Z

- Git baseline: `d108808` (pre demo-session-bypass commit)
- Backend redeployed for demo MOCK session bypass: `sha256:003d831f77ce97accdbc3cc2bb6d52df2600428b267f492fc8a4279d714bdc96`
- Frontend unchanged: `sha256:23b996c071ca897d8d856879fcb5894e460f69ea609a8c16dee1353e90add733`
- Matching engine unchanged
- REAL_FOREX: off (API `realForex: false`)
- Runtime session: WEEKEND_CLOSURE; DEMO MOCK bypass active when `FOREX_DEMO_FUNDING=true`

See `.build/FOREX_POST_DEPLOY_DB_CERTIFICATION.json` for full lifecycle + DB evidence.
