'use client';

import { useState, useEffect, useCallback, memo, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  PanelRightClose, PanelRightOpen,
  AlertTriangle, Siren,
  Activity, ArrowDownToLine, ArrowUpFromLine,
  Repeat2, UserPlus, ShieldCheck, Ban,
  Wifi, WifiOff, Clock,
} from 'lucide-react';
import { useAdminAuthStore } from '@/store/auth';
import { useAdminAlertStore } from '@/store/adminAlerts';
import { useRealtimeStore, type RealtimeActivity } from '@/store/realtime';
import { getAuditActivityLogs, type AuditActivityLog } from '@/lib/api';
import { getMonitoringIncidents, type IncidentRow } from '@/lib/monitoring-api';
import type { InfrastructureAlertRow } from '@/lib/monitoring-api';
import { ADMIN_FEATURE_FLAGS } from '@/lib/admin/featureFlags';
import { cn } from '@/lib/cn';

function timeAgo(ts: number): string {
  const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

type Tab = 'alerts' | 'activity' | 'incidents' | 'insights';

function RightPanelInner() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('alerts');

  const infrastructureAlerts = useAdminAlertStore((s) => s.infrastructureAlerts);
  const alertSummary = useAdminAlertStore((s) => s.alertSummary);
  const token = useAdminAuthStore((s) => s.accessToken);

  const { data: incidentsRes } = useQuery({
    queryKey: ['admin', 'right-panel', 'incidents', token],
    queryFn: () => getMonitoringIncidents(token, { limit: 15, status: 'open' }),
    enabled: !!token && ADMIN_FEATURE_FLAGS.ADMIN_INCIDENT_SYSTEM,
    staleTime: 20_000,
    refetchInterval: 30_000,
  });

  const dbIncidents = incidentsRes?.data?.incidents ?? [];
  const recentInfraAlerts = useMemo(
    () => infrastructureAlerts.filter((a) => a.status === 'open' || a.status === 'acknowledged').slice(0, 15),
    [infrastructureAlerts],
  );

  const alertCount = alertSummary?.open ?? recentInfraAlerts.length;
  const incidentCount = dbIncidents.length;

  const TABS: { id: Tab; label: string; count: number; icon: React.ElementType; flag?: boolean }[] = [
    { id: 'alerts', label: 'Alerts', count: alertCount, icon: AlertTriangle },
    { id: 'activity', label: 'Activity', count: 0, icon: Activity },
    { id: 'incidents', label: 'Incidents', count: incidentCount, icon: Siren, flag: ADMIN_FEATURE_FLAGS.ADMIN_INCIDENT_SYSTEM },
  ];

  const visibleTabs = TABS.filter((t) => t.flag !== false);

  if (!open) {
    const totalBadge = alertCount + incidentCount;
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 hidden lg:flex flex-col items-center gap-2 rounded-l-lg border border-r-0 border-admin-border bg-admin-card px-1.5 py-3 shadow-md hover:bg-white/5 transition-colors"
        aria-label="Open panel"
      >
        <PanelRightOpen className="h-4 w-4 text-admin-muted" />
        {totalBadge > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white px-1">
            {totalBadge > 99 ? '99+' : totalBadge}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed right-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-80 max-w-[85vw] border-l border-admin-border bg-admin-card shadow-lg flex flex-col animate-slide-in-right">
      {/* Header — tabs */}
      <div className="flex items-center justify-between border-b border-admin-border px-2 py-2 shrink-0">
        <div className="flex items-center gap-1 overflow-x-auto">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-admin-primary/10 text-admin-primary'
                  : 'text-admin-muted hover:text-admin-text'
              )}
            >
              <tab.icon className="h-3 w-3" />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-0.5 rounded-full bg-red-100 text-red-600 text-[9px] font-bold px-1">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-admin-muted hover:bg-white/5 transition-colors shrink-0 ml-1"
          aria-label="Close panel"
        >
          <PanelRightClose className="h-4 w-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'alerts' && <InfraAlertsList alerts={recentInfraAlerts} />}
        {activeTab === 'activity' && <ActivityStream />}
        {activeTab === 'incidents' && <DbIncidentsList incidents={dbIncidents} />}
      </div>
    </div>
  );
}

export const RightPanel = memo(RightPanelInner);

/* ------------------------------------------------------------------ */
/*  Activity Stream — real-time from WS with polling fallback          */
/* ------------------------------------------------------------------ */

interface ActivityEvent {
  id: string;
  type: 'trade' | 'deposit' | 'withdrawal' | 'signup' | 'kyc' | 'alert' | 'ban' | 'admin';
  message: string;
  timestamp: number;
}

const EVENT_ICONS: Record<ActivityEvent['type'], { icon: React.ElementType; color: string }> = {
  trade:      { icon: Repeat2, color: 'text-blue-500' },
  deposit:    { icon: ArrowDownToLine, color: 'text-admin-success' },
  withdrawal: { icon: ArrowUpFromLine, color: 'text-admin-warning' },
  signup:     { icon: UserPlus, color: 'text-violet-500' },
  kyc:        { icon: ShieldCheck, color: 'text-cyan-500' },
  alert:      { icon: AlertTriangle, color: 'text-admin-danger' },
  ban:        { icon: Ban, color: 'text-admin-danger' },
  admin:      { icon: Activity, color: 'text-admin-primary' },
};

function classifyAction(action: string): ActivityEvent['type'] {
  const a = action.toLowerCase();
  if (a.includes('trade') || a.includes('order') || a.includes('match')) return 'trade';
  if (a.includes('deposit') || a.includes('credit')) return 'deposit';
  if (a.includes('withdraw') || a.includes('freeze')) return 'withdrawal';
  if (a.includes('kyc') || a.includes('verification')) return 'kyc';
  if (a.includes('alert') || a.includes('aml') || a.includes('risk')) return 'alert';
  if (a.includes('ban') || a.includes('block') || a.includes('suspend')) return 'ban';
  if (a.includes('signup') || a.includes('register')) return 'signup';
  return 'admin';
}

function realtimeToActivity(rt: RealtimeActivity): ActivityEvent {
  return { id: rt.id, type: classifyAction(rt.type), message: rt.message, timestamp: rt.timestamp };
}

function mapLogsToEvents(logs: AuditActivityLog[]): ActivityEvent[] {
  return logs.map((log) => ({
    id: log.id,
    type: classifyAction(log.action),
    message: `${log.adminName}: ${log.action.replace(/_/g, ' ')}`,
    timestamp: new Date(log.createdAt).getTime(),
  }));
}

function ActivityStream() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const connectionState = useRealtimeStore((s) => s.connectionState);
  const shouldPoll = useRealtimeStore((s) => s.shouldPoll);
  const liveEvents = useRealtimeStore((s) => s.liveEvents);

  const isWsConnected = connectionState === 'connected';

  // Polling fallback: only enabled when WS is down
  const { data: pollData } = useQuery({
    queryKey: ['admin', 'activity-stream', token],
    queryFn: () => getAuditActivityLogs(token, { limit: 30 }),
    enabled: !!token && (shouldPoll || !isWsConnected),
    staleTime: 10000,
    refetchInterval: shouldPoll ? 15000 : false,
  });

  const events = useMemo<ActivityEvent[]>(() => {
    if (isWsConnected && liveEvents.length > 0) {
      return liveEvents.slice(0, 30).map(realtimeToActivity);
    }
    // Fallback to polled data
    const logs = pollData?.data?.logs ?? [];
    if (logs.length > 0) return mapLogsToEvents(logs);
    // Show any live events even if WS reconnecting
    if (liveEvents.length > 0) return liveEvents.slice(0, 30).map(realtimeToActivity);
    return [];
  }, [isWsConnected, liveEvents, pollData]);

  if (events.length === 0) {
    return <EmptyState icon={Activity} text="No recent activity" />;
  }

  return (
    <div>
      {/* Connection status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-admin-border/50 bg-white/[0.02]">
        <span className="text-[10px] text-admin-muted font-medium">Activity feed</span>
        <span className={cn(
          'text-[10px] font-medium flex items-center gap-1',
          isWsConnected ? 'text-admin-success' : connectionState === 'reconnecting' ? 'text-admin-warning' : 'text-admin-muted'
        )}>
          {isWsConnected ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
          {isWsConnected ? 'Live' : connectionState === 'reconnecting' ? 'Reconnecting…' : shouldPoll ? 'Polling' : 'Connecting…'}
        </span>
      </div>

      <div className="divide-y divide-admin-border/50">
        {events.map((evt) => {
          const cfg = EVENT_ICONS[evt.type] ?? EVENT_ICONS.admin;
          const Icon = cfg.icon;
          return (
            <div key={evt.id} className="px-3 py-2 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-start gap-2">
                <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', cfg.color)} />
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-admin-text leading-snug">{evt.message}</p>
                  <span className="text-[10px] text-admin-muted flex items-center gap-0.5 mt-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {timeAgo(evt.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Existing sub-views (kept intact)                                   */
/* ------------------------------------------------------------------ */

function InfraAlertsList({ alerts }: { alerts: InfrastructureAlertRow[] }) {
  if (alerts.length === 0) {
    return <EmptyState icon={AlertTriangle} text="No open infrastructure alerts" />;
  }
  return (
    <div className="divide-y divide-admin-border">
      {alerts.map((a) => {
        const sev = (a.severity || 'info').toLowerCase();
        const ts = a.created_at ? new Date(a.created_at).getTime() : Date.now();
        return (
          <div key={a.id} className="px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
            <div className="flex items-start gap-2">
              <span className={cn(
                'mt-0.5 h-2 w-2 rounded-full shrink-0',
                sev === 'critical' || sev === 'high' ? 'bg-red-500' : sev === 'warning' ? 'bg-amber-500' : 'bg-violet-500'
              )} />
              <div className="min-w-0 flex-1">
                <p className="text-xs text-admin-text leading-snug">{a.message}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] uppercase font-bold tracking-wider text-admin-muted">{a.system}</span>
                  <span className="text-[10px] text-admin-muted flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />
                    {timeAgo(ts)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DbIncidentsList({ incidents }: { incidents: IncidentRow[] }) {
  if (incidents.length === 0) {
    return <EmptyState icon={Siren} text="No open incidents" />;
  }
  return (
    <div className="divide-y divide-admin-border">
      {incidents.map((inc) => (
        <div key={inc.id} className="px-3 py-2.5 hover:bg-white/[0.03] transition-colors">
          <p className="text-xs font-medium text-admin-text truncate">{inc.service.replace(/_/g, ' ')}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={cn(
              'text-[9px] uppercase font-bold tracking-wider rounded px-1 py-0.5',
              inc.severity === 'critical' ? 'bg-red-100 text-red-700' : inc.severity === 'warning' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
            )}>
              {inc.severity}
            </span>
            <span className="text-[10px] text-admin-muted">{inc.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-admin-muted">
      <Icon className="h-8 w-8 mb-2 opacity-30" />
      <p className="text-xs">{text}</p>
    </div>
  );
}
