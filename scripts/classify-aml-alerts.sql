-- Read-only AML alert classification. Do not bulk-clear.
-- Run: docker exec -i exchange-postgres psql -U exchange -d exchange -f - < scripts/classify-aml-alerts.sql

\echo '=== AML alerts by status ==='
SELECT status, COUNT(*) FROM aml_alerts GROUP BY 1 ORDER BY 2 DESC;

\echo '=== AML alerts by type ==='
SELECT COALESCE(alert_type, 'UNKNOWN') AS alert_type, status, COUNT(*)
FROM aml_alerts
GROUP BY 1, 2
ORDER BY 3 DESC
LIMIT 40;

\echo '=== open alerts age buckets ==='
SELECT
  CASE
    WHEN created_at >= NOW() - INTERVAL '1 day' THEN '1d'
    WHEN created_at >= NOW() - INTERVAL '7 days' THEN '7d'
    WHEN created_at >= NOW() - INTERVAL '30 days' THEN '30d'
    ELSE 'older'
  END AS age_bucket,
  COUNT(*)
FROM aml_alerts
WHERE status IN ('open', 'OPEN', 'new', 'NEW')
GROUP BY 1
ORDER BY 1;
