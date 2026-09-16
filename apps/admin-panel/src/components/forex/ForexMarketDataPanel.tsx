'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminConfig, getForexAdminExecution } from '@/lib/admin/forex-api';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ForexJsonPanel } from '@/components/forex/ForexJsonPanel';

export function ForexMarketDataPanel() {
  const token = useAdminAuthStore((s) => s.accessToken);

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', 'market-data', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
  });

  const execQ = useQuery({
    queryKey: ['admin', 'forex', 'execution', 'market-data', token],
    queryFn: async () => {
      const res = await getForexAdminExecution(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token,
    staleTime: 10_000,
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {configQ.data ? (
        <ForexJsonPanel title="Market-data worker & runtime" data={configQ.data.runtime.marketData} />
      ) : null}
      <Card>
        <CardHeader className="pb-2 text-sm font-medium">MOCK LP provider health</CardHeader>
        <CardContent className="space-y-2">
          {execQ.data?.providers.map((p) => (
            <div key={p.providerId} className="flex flex-wrap items-center gap-2 rounded border border-admin-border/70 px-2 py-1.5 text-xs">
              <span className="font-medium">{p.providerCode}</span>
              {p.health ? (
                <Badge variant={p.health.status === 'HEALTHY' ? 'success' : 'warning'} className="font-normal">
                  {p.health.status}
                </Badge>
              ) : (
                <Badge variant="default">No quotes yet</Badge>
              )}
              <span className="text-admin-muted">quotes {p.health?.quoteCount ?? 0}</span>
            </div>
          )) ?? <p className="text-sm text-admin-muted">Loading providers…</p>}
        </CardContent>
      </Card>
    </div>
  );
}
