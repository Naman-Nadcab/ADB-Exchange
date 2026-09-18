/**
 * Read-only KYC / AML risk signals for Forex CRM (mirrors admin users list heuristics).
 */

export type ForexCrmUserRiskLevel = 'low' | 'medium' | 'high';

export type ForexCrmUserCompliance = {
  kyc_status: string | null;
  kyc_level: number | null;
  risk_level: ForexCrmUserRiskLevel;
  risk_flags: string[];
};

export function deriveForexCrmUserCompliance(row: {
  kyc_status: string | null;
  kyc_level: number | null;
  aml_alert_count: number;
  login_fail_7d: number;
  withdrawal_count_30d: number;
}): ForexCrmUserCompliance {
  const flags: string[] = [];
  const aml = row.aml_alert_count || 0;
  const loginFail = row.login_fail_7d || 0;
  const wdCount = row.withdrawal_count_30d || 0;
  if (aml > 0) flags.push('AML alert');
  if (loginFail > 2) flags.push('Multiple failed logins');
  if (wdCount > 10) flags.push('High withdrawal activity');

  let risk_level: ForexCrmUserRiskLevel = 'low';
  if (aml > 0 || loginFail > 5) risk_level = 'high';
  else if (flags.length > 0) risk_level = 'medium';

  return {
    kyc_status: row.kyc_status,
    kyc_level: row.kyc_level,
    risk_level,
    risk_flags: flags,
  };
}

/** SQL fragments — user_id column is forex_accounts.user_id (text, matches users.id::text). */
export const CRM_USER_KYC_STATUS_SQL = `(
  SELECT ka.status FROM kyc_applications ka
  WHERE ka.user_id::text = fa.user_id
  ORDER BY ka.submitted_at DESC NULLS LAST
  LIMIT 1
)`;

export const CRM_USER_KYC_LEVEL_SQL = `(
  SELECT ka.kyc_level FROM kyc_applications ka
  WHERE ka.user_id::text = fa.user_id
  ORDER BY ka.submitted_at DESC NULLS LAST
  LIMIT 1
)`;

export const CRM_USER_AML_COUNT_SQL = `(
  SELECT COUNT(*)::int FROM aml_alerts a
  WHERE a.user_id::text = fa.user_id AND a.status IN ('open','reviewing')
)`;

export const CRM_USER_LOGIN_FAIL_SQL = `(
  SELECT COUNT(*)::int FROM user_activity_logs ua
  WHERE ua.user_id::text = fa.user_id
    AND ua.activity_type = 'login_failed'
    AND ua.created_at > NOW() - INTERVAL '7 days'
)`;

export const CRM_USER_WITHDRAWAL_30D_SQL = `(
  SELECT COUNT(*)::int FROM withdrawals w
  WHERE w.user_id::text = fa.user_id AND w.created_at > NOW() - INTERVAL '30 days'
)`;
