# Infrastructure Report

Verdict: **WARNING**

- PASS: Container exchange-postgres — running
- PASS: Container exchange-redis — running
- PASS: Container exchange-backend — running
- PASS: Container exchange-matching-engine — running
- PASS: Container exchange-nats — running
- FAIL: Backend /health — {"status":"degraded","timestamp":"2026-07-02T08:13:55.304Z","services":{"database":"up","redis":"up","nats":"up","matching_engine":"up","indexer":"up"},"warnings":["settlement_circuit_open"],"ws_disconnect_rate_per_sec":0,"gates":{"require_nats":false,"require_matching_engine":true,"fail_on_stale_indexer":false},"checks":{"database":{"ok":true,"latency_ms":2,"attempts":1,"error":null},"redis":{"ok":true,"latency_ms":1,"error":null},"safety":{"trading_halt_active":false,"settlement_circuit_open":true},"nats":{"configured":true,"ok":true,"stream_status":{"SPOT_MATCH":"ok","SPOT_ORDERBOOK":"ok","MATCH_EVENTS":"ok","MATCH_SETTLEMENT_DLQ":"ok"}},"matching_engine":{"configured":true,"ok":true,"latency_ms":2}},"probe":{"duration_ms":356,"dependency_latency_ms":{"database":2,"redis":1,"nats":14,"matching_engine":2},"failure_reason":null},"depth":{"settlement_pending":438,"settlement_lag_sec":181.365026,"withdrawal_queue":0,"indexer_lag_sec":1}}
- PASS: Matching engine WAL — buffer=694
- PASS: Admin login — token ok
- PASS: Monitoring workers — 27 registered