/**
 * Public referral leaderboard — top referrers by lifetime earnings (real DB data).
 */
import { db } from '../lib/database.js';

export type LeaderboardEntry = {
  rank: number;
  user: string;
  totalEarnings: number;
};

function maskDisplayName(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  if (!s) return 'User';
  if (s.includes('@')) {
    const [localPart, domain] = s.split('@');
    const head = (localPart ?? '').slice(0, 2);
    return `${head}***@${domain ?? '***'}`;
  }
  if (s.length <= 4) return `${s[0] ?? 'U'}***`;
  return `${s.slice(0, 3)}***`;
}

export async function getReferralLeaderboard(limit = 20): Promise<LeaderboardEntry[]> {
  const capped = Math.min(50, Math.max(5, limit));
  const result = await db.query<{ display_name: string | null; email: string | null; total_earnings: string }>(`
    SELECT
      COALESCE(u.username, SPLIT_PART(u.email, '@', 1)) AS display_name,
      u.email,
      COALESCE(rc.total_earnings, 0)::text AS total_earnings
    FROM referral_codes rc
    JOIN users u ON u.id = rc.user_id AND u.deleted_at IS NULL
    WHERE rc.is_active = TRUE
      AND COALESCE(rc.total_earnings, 0) > 0
    ORDER BY rc.total_earnings DESC NULLS LAST, rc.current_referrals DESC
    LIMIT $1
  `, [capped]);

  return result.rows.map((row, index) => ({
    rank: index + 1,
    user: maskDisplayName(row.display_name ?? row.email),
    totalEarnings: parseFloat(row.total_earnings) || 0,
  }));
}
