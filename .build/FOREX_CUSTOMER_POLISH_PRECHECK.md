# Forex customer polish precheck

See `.build/FOREX_CUSTOMER_POLISH_PRECHECK.json` for architecture notes.

Alerts: server-persisted (`forex_customer_alerts`). Prior `ALERT_CREATE_FAILED` in production cert was invalid API payload, not a product defect.

Drawings: native + Forex extra engines; localStorage key `eda-forex-drawings:{instance}:{symbol}:{timeframe}`.
