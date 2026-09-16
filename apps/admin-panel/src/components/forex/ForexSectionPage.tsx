'use client';

import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexControlGrid } from '@/components/forex/ForexControlGrid';
import { controlGroupsForRoute } from '@/lib/admin/forex-control-registry';
import type { ForexAdminRoute } from '@/lib/admin/forex-admin-nav';
import { FOREX_ADMIN_PHASES } from '@/lib/admin/forex-admin-nav';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ForexSectionPage({ route }: { route: ForexAdminRoute }) {
  const groups = controlGroupsForRoute(route.href);
  const phaseMeta = FOREX_ADMIN_PHASES.find((p) => p.id === route.phase);

  return (
    <AdminPageFrame
      title={route.label}
      description={route.description}
      status={route.phase === 'F5' ? 'warning' : 'active'}
      quickActions={
        <Badge variant="info" className="font-normal">
          Rollout: {route.phase} — {phaseMeta?.title ?? route.phase}
        </Badge>
      }
    >
      <Card className="border-dashed border-violet-500/25 bg-violet-500/5">
        <CardContent className="py-3 text-sm text-admin-muted">
          This section is part of the <strong className="text-foreground">Forex admin layout (F0)</strong>.
          Controls below are the full planned surface; wiring to{' '}
          <code className="text-xs text-violet-300">/api/v1/admin/forex/*</code> lands in phase{' '}
          <strong className="text-foreground">{route.phase}</strong> and later.
        </CardContent>
      </Card>

      <ForexControlGrid groups={groups.length ? groups : controlGroupsForRoute('/forex')} />
    </AdminPageFrame>
  );
}
