-- Read-only settlement / DLQ classification. Do not DELETE or UPDATE financial rows.
-- Run: docker exec -i exchange-postgres psql -U exchange -d exchange -f - < scripts/classify-settlement-dlq.sql

\echo '=== settlement_events by status ==='
SELECT status, COUNT(*) FROM settlement_events GROUP BY 1 ORDER BY 2 DESC;

\echo '=== quarantined settlement reason buckets ==='
SELECT COALESCE(quarantine_reason, last_error, 'UNKNOWN') AS reason, COUNT(*)
FROM settlement_events
WHERE status IN ('quarantined', 'QUARANTINED', 'failed', 'FAILED')
GROUP BY 1
ORDER BY 2 DESC
LIMIT 30;

\echo '=== DLQ by last_error ==='
SELECT COALESCE(last_error, 'UNKNOWN') AS last_error, COUNT(*)
FROM settlement_events_dlq
GROUP BY 1
ORDER BY 2 DESC;

\echo '=== DLQ classification heuristic ==='
SELECT
  CASE
    WHEN last_error = 'SETTLEMENT_USER_NOT_FOUND' THEN 'ORPHAN'
    WHEN last_error = 'INSUFFICIENT_LOCKED_FUNDS' THEN 'UNKNOWN'
    WHEN last_error = 'ORDER_INVARIANT_VIOLATION' THEN 'UNKNOWN'
    WHEN last_error ILIKE '%TEST%' OR payload::text ILIKE '%synthetic%' OR payload::text ILIKE '%RC-003%' THEN 'TEST'
    WHEN last_error ILIKE '%DUPLICATE%' THEN 'DUPLICATE'
    ELSE 'UNKNOWN'
  END AS class,
  last_error,
  COUNT(*)
FROM settlement_events_dlq
GROUP BY 1, 2
ORDER BY 3 DESC;

\echo '=== quarantined classification ==='
SELECT
  CASE
    WHEN quarantine_reason ILIKE '%RC-003%' OR quarantine_reason ILIKE '%synthetic%' THEN 'TEST'
    WHEN quarantine_reason ILIKE '%duplicate%' THEN 'DUPLICATE'
    ELSE 'UNKNOWN'
  END AS class,
  COUNT(*)
FROM settlement_events
WHERE status = 'quarantined'
GROUP BY 1
ORDER BY 2 DESC;

\echo '=== processed vs quarantined vs dlq ==='
SELECT
  (SELECT COUNT(*) FROM settlement_events WHERE status = 'processed') AS processed_events,
  (SELECT COUNT(*) FROM settlement_events WHERE status = 'quarantined') AS quarantined_events,
  (SELECT COUNT(*) FROM settlement_events_dlq) AS dlq_rows;
