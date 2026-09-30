'use client';

import { FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';
import { forexRouteMaturity } from '@/lib/admin/forex-nav-groups';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';
import type { ForexSemanticTone } from '@/components/forex/primitives/forex-semantic-system';

function maturityTone(m: ReturnType<typeof forexRouteMaturity>): ForexSemanticTone {
  if (m === 'production') return 'success';
  if (m === 'beta') return 'info';
  return 'neutral';
}

export function ForexRouteWorkspace(props: {
  routeId: string;
  kpis?: Array<{ label: string; value: string; tone?: 'default' | 'warning' | 'danger' | 'success' }>;
  posture?: 'MOCK' | 'SIMULATED' | 'LIVE' | 'NOT_CONFIGURED';
  dataSource?: string;
}) {
  const route = FOREX_ADMIN_ROUTES.find((r) => r.id === props.routeId);
  if (!route) return null;

  const maturity = forexRouteMaturity(props.routeId);
  const matTone = maturityTone(maturity);
  const defaultKpis: Array<{ label: string; value: string; tone?: 'default' | 'warning' | 'danger' | 'success' }> = [
    {
      label: 'Maturity',
      value: maturity.charAt(0).toUpperCase() + maturity.slice(1),
      tone: matTone === 'success' ? 'success' : matTone === 'warning' ? 'warning' : 'default',
    },
    { label: 'Phase', value: route.phase ?? '—' },
    { label: 'Venue', value: props.posture ?? 'MOCK', tone: 'warning' },
    { label: 'Surface', value: 'Ops workspace' },
  ];

  return (
    <ForexWorkspaceHeader
      title={route.label}
      purpose={route.description}
      dataSource={props.dataSource ?? 'Admin Forex API · PostgreSQL (MOCK/SIMULATED venue)'}
      posture={props.posture ?? 'MOCK'}
      kpis={props.kpis ?? defaultKpis}
    />
  );
}
