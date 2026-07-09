'use client';

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { useAdminAlertStore } from '@/store/adminAlerts';
import { getMonitoringAlerts, getMonitoringAlertSummary } from '@/lib/monitoring-api';
import { useAdminWs } from '@/hooks/useAdminWs';

const POLL_MS = 30_000;

/**
 * Keeps Alert Center drawer + topbar badge in sync with infrastructure_alerts.
 * Runs once at protected layout level.
 */
export function useAlertCenterSync() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const syncFromBackend = useAdminAlertStore((s) => s.syncFromBackend);

  const { data: summaryRes } = useQuery({
    queryKey: ['admin', 'alert-center', 'summary', token],
    queryFn: () => getMonitoringAlertSummary(token),
    enabled: !!token,
    staleTime: 15_000,
    refetchInterval: POLL_MS,
  });

  const { data: alertsRes } = useQuery({
    queryKey: ['admin', 'alert-center', 'recent', token],
    queryFn: () => getMonitoringAlerts(token, { limit: 25, status: 'open' }),
    enabled: !!token,
    staleTime: 15_000,
    refetchInterval: POLL_MS,
  });

  useEffect(() => {
    const summary = summaryRes?.data;
    const alerts = alertsRes?.data?.alerts;
    if (summary && alerts) {
      syncFromBackend(alerts, summary);
    } else if (summary) {
      syncFromBackend([], summary);
    }
  }, [summaryRes, alertsRes, syncFromBackend]);

  useAdminWs({
    onEvent: (ev) => {
      const t = (ev?.type as string) ?? '';
      if (
        ['system_alert', 'infrastructure_action', 'timeline_event', 'rpc_timeout', 'queue_overflow', 'node_failure'].includes(t)
      ) {
        queryClient.invalidateQueries({ queryKey: ['admin', 'alert-center'] });
        queryClient.invalidateQueries({ queryKey: ['admin', 'monitoring', 'alerts'] });
      }
    },
  });
}
