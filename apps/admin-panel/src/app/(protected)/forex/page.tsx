'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminOverview } from '@/lib/admin/forex-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexCommandCenterView } from '@/components/forex/panels/ForexCommandCenterView';
import { Badge } from '@/components/ui/Badge';
import { deriveForexVenueMode } from '@/lib/admin/forex-posture';

export default function ForexAdminOverviewPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const overviewQ = useQuery({
    queryKey: ['admin', 'forex', 'overview', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 15_000,
  });

  const ready = overviewQ.data?.readiness.economicReady;
  const venue = deriveForexVenueMode(overviewQ.data?.posture);
  const venueBadgeVariant = venue.mode === 'LIVE' ? 'danger' : venue.mode === 'SIMULATED' ? 'warning' : 'info';

  return (
    <AdminPageFrame
      title="Forex Command Center"
      description="Operator OS — posture, market pulse, attention, and domain workspaces."
      status={ready ? 'active' : 'warning'}
      error={overviewQ.isError ? (overviewQ.error instanceof Error ? overviewQ.error.message : 'Load failed') : null}
      onRetry={() => overviewQ.refetch()}
      quickActions={
        overviewQ.data ? (
          <Badge variant={venueBadgeVariant} className="font-semibold">
            {venue.mode}
          </Badge>
        ) : undefined
      }
    >
      <ForexCommandCenterView />
    </AdminPageFrame>
  );
}
