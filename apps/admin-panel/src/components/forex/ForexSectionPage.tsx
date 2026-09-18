'use client';

import { useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { getForexAdminConfig, getForexAdminOverview, getForexAdminSystem } from '@/lib/admin/forex-api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ForexAdminOpsTable, type ForexOpsTableKind } from '@/components/forex/ForexAdminOpsTable';
import { ForexGlobalControlsPanel } from '@/components/forex/ForexGlobalControlsPanel';
import { ForexPolicyPanel } from '@/components/forex/ForexPolicyPanel';
import { ForexExecutionPanel } from '@/components/forex/ForexExecutionPanel';
import { ForexJournalAuditPanel } from '@/components/forex/ForexJournalAuditPanel';
import { ForexLedgerPanel } from '@/components/forex/ForexLedgerPanel';
import { ForexTradingAccountsPanel } from '@/components/forex/panels/ForexTradingAccountsPanel';
import { ForexMarketDataPanel } from '@/components/forex/ForexMarketDataPanel';
import { ForexCommandDeskPanel } from '@/components/forex/panels/ForexCommandDeskPanel';
import { ForexInstrumentsPanel } from '@/components/forex/panels/ForexInstrumentsPanel';
import { ForexSessionsPanel } from '@/components/forex/panels/ForexSessionsPanel';
import { ForexSystemPanel } from '@/components/forex/panels/ForexSystemPanel';
import { ForexDealingDeskPanel } from '@/components/forex/panels/ForexDealingDeskPanel';
import { ForexProtectionPanel } from '@/components/forex/panels/ForexProtectionPanel';
import { ForexLiquidationPanel } from '@/components/forex/panels/ForexLiquidationPanel';
import { ForexIntegrationsPanel } from '@/components/forex/panels/ForexIntegrationsPanel';
import { ForexCrmClientsPanel } from '@/components/forex/panels/ForexCrmClientsPanel';
import { ForexCrmFinancePanel } from '@/components/forex/panels/ForexCrmFinancePanel';
import { ForexCrmLeadsPanel } from '@/components/forex/panels/ForexCrmLeadsPanel';
import { ForexAccountGroupsPanel } from '@/components/forex/panels/ForexAccountGroupsPanel';
import { ForexCrmTasksPanel } from '@/components/forex/panels/ForexCrmTasksPanel';
import { ForexCrmPipelinePanel } from '@/components/forex/panels/ForexCrmPipelinePanel';
import { ForexReportingPanel } from '@/components/forex/panels/ForexReportingPanel';
import { ForexRiskControlPanel } from '@/components/forex/panels/ForexRiskControlPanel';
import { ForexRiskHubPanel } from '@/components/forex/panels/ForexRiskHubPanel';
import { ForexPartnersPanel } from '@/components/forex/panels/ForexPartnersPanel';
import { ForexRoutingDeskPanel } from '@/components/forex/panels/ForexRoutingDeskPanel';
import { ForexNotificationsPanel } from '@/components/forex/panels/ForexNotificationsPanel';
import { ForexCompliancePanel } from '@/components/forex/panels/ForexCompliancePanel';
import { ForexAutomationPanel } from '@/components/forex/panels/ForexAutomationPanel';
import { ForexHolidayCalendarPanel } from '@/components/forex/panels/ForexHolidayCalendarPanel';
import { ForexCrmHomePanel } from '@/components/forex/panels/ForexCrmHomePanel';
import { ForexCrmMyClientsPanel } from '@/components/forex/panels/ForexCrmMyClientsPanel';
import { ForexCrmSegmentsPanel } from '@/components/forex/panels/ForexCrmSegmentsPanel';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';
import { forexRouteMaturity } from '@/lib/admin/forex-nav-groups';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ForexWorkspaceHeader } from '@/components/forex/primitives/ForexWorkspaceHeader';

/** Panels that render their own workspace header (avoid duplicate). */
const PANEL_OWN_WORKSPACE_HEADER = new Set(['command', 'dealing', 'market-data', 'accounts', 'automation']);

const OPS_TABLE_KIND: Record<string, ForexOpsTableKind> = {
  orders: 'orders',
  executions: 'executions',
  positions: 'positions',
};

function LoadingBlock(props: { label?: string; variant?: 'kpi' | 'text' }) {
  if (props.variant === 'kpi') return <KpiSkeleton count={4} />;
  return (
    <Card className="border-admin-border/60">
      <CardContent className="py-8 text-center text-sm text-admin-muted">{props.label ?? 'Loading…'}</CardContent>
    </Card>
  );
}

function maturityQuickBadge(routeId: string) {
  const m = forexRouteMaturity(routeId);
  if (m === 'production') return <Badge variant="success">Production</Badge>;
  if (m === 'beta') return <Badge variant="info">Beta</Badge>;
  return <Badge variant="default">Roadmap</Badge>;
}

export function ForexSectionPage({ sectionId }: { sectionId: string }) {
  const token = useAdminAuthStore((s) => s.accessToken);
  const route = FOREX_ADMIN_ROUTES.find((r) => r.id === sectionId);
  const routeId = route?.id ?? sectionId;

  const needsConfig = routeId === 'sessions' || routeId === 'system' || routeId === 'command';
  const needsOverview = routeId === 'command';
  const needsSystem = routeId === 'system' || routeId === 'command';

  const configQ = useQuery({
    queryKey: ['admin', 'forex', 'config', token],
    queryFn: async () => {
      const res = await getForexAdminConfig(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && needsConfig,
    staleTime: 30_000,
  });

  const overviewQ = useQuery({
    queryKey: ['admin', 'forex', 'overview', token],
    queryFn: async () => {
      const res = await getForexAdminOverview(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && needsOverview,
    staleTime: 15_000,
  });

  const systemQ = useQuery({
    queryKey: ['admin', 'forex', 'system', token],
    queryFn: async () => {
      const res = await getForexAdminSystem(token);
      if (!res.success || !res.data) throw new Error(res.error?.message ?? 'Failed');
      return res.data;
    },
    enabled: !!token && needsSystem,
    staleTime: 15_000,
  });

  if (!route) {
    return (
      <AdminPageFrame title="Forex section" error={`Unknown section: ${sectionId}`}>
        <p className="text-sm text-admin-muted">This Forex admin route is not registered.</p>
      </AdminPageFrame>
    );
  }

  if (!token) {
    return (
      <AdminPageFrame title={route.label} description={route.description}>
        <LoadingBlock label="Waiting for admin session…" />
      </AdminPageFrame>
    );
  }

  const loadError = configQ.isError
    ? configQ.error
    : overviewQ.isError
      ? overviewQ.error
      : systemQ.isError
        ? systemQ.error
        : null;

  const notReady = configQ.data?.readiness.economicReady === false;

  function renderBody() {
    switch (routeId) {
      case 'command':
        return overviewQ.isLoading && systemQ.isLoading ? (
          <LoadingBlock variant="kpi" />
        ) : (
          <ForexCommandDeskPanel
            overview={overviewQ.data}
            system={systemQ.data}
            loading={overviewQ.isLoading || systemQ.isLoading}
          />
        );
      case 'instruments':
        return <ForexInstrumentsPanel />;
      case 'sessions':
        return configQ.isLoading ? (
          <LoadingBlock label="Loading sessions…" />
        ) : (
          <>
            <ForexSessionsPanel sessions={configQ.data?.config.sessions} holiday={configQ.data?.readiness.holiday} />
            <ForexHolidayCalendarPanel />
          </>
        );
      case 'system':
        return systemQ.isLoading && configQ.isLoading ? (
          <LoadingBlock label="Loading system…" />
        ) : (
          <ForexSystemPanel system={systemQ.data} config={configQ.data} loading={systemQ.isLoading} />
        );
      case 'market-data':
        return <ForexMarketDataPanel />;
      case 'orders':
      case 'executions':
      case 'positions':
        return <ForexAdminOpsTable kind={OPS_TABLE_KIND[routeId] ?? 'orders'} />;
      case 'protection':
        return <ForexProtectionPanel />;
      case 'liquidation':
        return <ForexLiquidationPanel />;
      case 'controls':
        return <ForexGlobalControlsPanel />;
      case 'fees-swaps':
        return <ForexPolicyPanel mode="fees-swaps" />;
      case 'margin-risk':
        return <ForexPolicyPanel mode="margin-risk" />;
      case 'dealing':
        return <ForexDealingDeskPanel />;
      case 'notifications':
        return <ForexNotificationsPanel />;
      case 'compliance':
        return <ForexCompliancePanel />;
      case 'automation':
        return <ForexAutomationPanel />;
      case 'lp-execution':
        return <ForexExecutionPanel />;
      case 'integrations':
        return <ForexIntegrationsPanel />;
      case 'crm-home':
        return <ForexCrmHomePanel />;
      case 'crm-my-clients':
        return <ForexCrmMyClientsPanel />;
      case 'crm-segments':
        return <ForexCrmSegmentsPanel />;
      case 'crm-leads':
        return <ForexCrmLeadsPanel />;
      case 'crm-clients':
        return <ForexCrmClientsPanel />;
      case 'crm-finance':
        return <ForexCrmFinancePanel />;
      case 'crm-tasks':
        return <ForexCrmTasksPanel />;
      case 'crm-pipeline':
        return <ForexCrmPipelinePanel />;
      case 'forex-reporting':
        return <ForexReportingPanel />;
      case 'risk-control':
        return (
          <>
            <ForexRiskControlPanel />
            <ForexRiskHubPanel />
          </>
        );
      case 'forex-partners':
        return <ForexPartnersPanel />;
      case 'account-groups':
        return <ForexAccountGroupsPanel />;
      case 'liquidity-routing':
        return <ForexRoutingDeskPanel />;
      case 'accounts':
        return <ForexTradingAccountsPanel />;
      case 'ledger':
        return <ForexLedgerPanel />;
      case 'journal-audit':
        return <ForexJournalAuditPanel />;
      default:
        return <LoadingBlock label="Section unavailable." />;
    }
  }

  return (
    <AdminPageFrame
      title={route.label}
      description={route.description}
      status={routeId === 'lp-execution' || notReady ? 'warning' : 'active'}
      error={loadError instanceof Error ? loadError.message : loadError ? String(loadError) : null}
      onRetry={() => {
        void configQ.refetch();
        void overviewQ.refetch();
        void systemQ.refetch();
      }}
      quickActions={maturityQuickBadge(routeId)}
    >
      {!PANEL_OWN_WORKSPACE_HEADER.has(routeId) ? (
        <ForexWorkspaceHeader
          title={route.label}
          purpose={route.description}
          dataSource="Admin Forex API · PostgreSQL (MOCK/SIMULATED venue)"
          posture="MOCK"
        />
      ) : null}
      {renderBody()}
    </AdminPageFrame>
  );
}
