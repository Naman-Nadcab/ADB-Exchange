/**
 * Referral analytics — time-series earnings and funnel from DB (no interpolation).
 */
import { db } from '../lib/database.js';

export type ReferralDailyEarning = {
  date: string;
  amount: number;
  currency: string;
};

export type ReferralFunnel = {
  signups: number;
  verified_users: number;
  active_traders: number;
  link_clicks: number;
};

export async function getReferralAnalytics(userId: string, days = 30): Promise<{
  dailyEarnings: ReferralDailyEarning[];
  funnel: ReferralFunnel;
}> {
  const periodDays = Math.min(90, Math.max(7, days));

  const dailyResult = await db.query<{ day: string; amount: string; currency: string }>(`
    SELECT DATE(created_at)::text AS day,
           SUM(commission_amount)::text AS amount,
           commission_currency AS currency
    FROM referral_commissions
    WHERE referrer_id = $1
      AND created_at >= NOW() - ($2::int || ' days')::interval
    GROUP BY DATE(created_at), commission_currency
    ORDER BY day ASC
  `, [userId, periodDays]);

  const dailyEarnings: ReferralDailyEarning[] = dailyResult.rows.map((r) => ({
    date: r.day,
    amount: parseFloat(r.amount) || 0,
    currency: r.currency || 'USDT',
  }));

  const funnelResult = await db.query<{ signups: string; active_traders: string; link_clicks: string }>(`
    SELECT
      (SELECT COUNT(*)::text FROM referral_relationships WHERE referrer_id = $1) AS signups,
      (SELECT COUNT(DISTINCT rc.referee_id)::text
         FROM referral_commissions rc
         WHERE rc.referrer_id = $1 AND rc.source_type = 'trade') AS active_traders,
      (SELECT COUNT(*)::text FROM referral_link_events WHERE referrer_id = $1) AS link_clicks
  `, [userId]).catch(async () => {
    const basic = await db.query<{ signups: string; active_traders: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM referral_relationships WHERE referrer_id = $1) AS signups,
        (SELECT COUNT(DISTINCT rc.referee_id)::text
           FROM referral_commissions rc
           WHERE rc.referrer_id = $1 AND rc.source_type = 'trade') AS active_traders
    `, [userId]);
    return { rows: [{ ...basic.rows[0], link_clicks: '0' }] };
  });

  const verifiedResult = await db.query<{ n: string }>(`
    SELECT COUNT(*)::text AS n
    FROM referral_relationships rr
    JOIN users u ON u.id = rr.referee_id
    WHERE rr.referrer_id = $1 AND (u.email_verified = TRUE OR u.phone_verified = TRUE)
  `, [userId]).catch(() => ({ rows: [{ n: '0' }] }));

  const row = funnelResult.rows[0];
  return {
    dailyEarnings,
    funnel: {
      signups: parseInt(row?.signups ?? '0', 10) || 0,
      verified_users: parseInt(verifiedResult.rows[0]?.n ?? '0', 10) || 0,
      active_traders: parseInt(row?.active_traders ?? '0', 10) || 0,
      link_clicks: parseInt(row?.link_clicks ?? '0', 10) || 0,
    },
  };
}
