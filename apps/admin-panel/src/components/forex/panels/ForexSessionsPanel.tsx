'use client';

import { useEffect, useMemo, useState } from 'react';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { ForexSessionTimeline } from '@/components/forex/panels/ForexSessionTimeline';
import { KpiSkeleton } from '@/components/ui/Skeleton';
import { Badge } from '@/components/ui/Badge';

type SessionEligibility = {
  open?: boolean;
  reason?: string;
  weekend?: boolean;
  holiday?: boolean;
  sessions?: string[];
  overlaps?: Array<[string, string] | string[]>;
};

type SessionSnapshot = {
  source?: string;
  calendar?: { id?: string; code?: string; name?: string; timezone?: string };
  /** Catalog session names (Sydney, Tokyo, …) */
  sessions?: string[];
  eligibility?: SessionEligibility;
  holidayCoverage?: boolean;
  holidayRequired?: boolean;
  holidaySafe?: boolean;
  exceptionsConfigured?: number;
  dstApplied?: boolean;
  dstModel?: string;
  weekendTimezone?: string;
  valuationPolicy?: string;
};

type HolidayReadiness = {
  coverage?: string;
  required?: boolean;
  holidaySafe?: boolean;
};

function asSnapshot(raw: unknown): SessionSnapshot | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as SessionSnapshot;
}

function asHolidayReadiness(raw: unknown): HolidayReadiness | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as HolidayReadiness;
}

function fmtList(values: unknown): string {
  if (values == null) return '—';
  if (typeof values === 'string') return values;
  if (Array.isArray(values)) {
    if (values.length === 0) return 'None';
    return values.every((v) => typeof v === 'string') ? values.join(', ') : `${values.length} item(s)`;
  }
  return '—';
}

function fmtOverlapPairs(overlaps: SessionEligibility['overlaps']): string {
  if (!overlaps?.length) return 'None';
  return overlaps
    .map((pair) => {
      if (Array.isArray(pair) && pair.length >= 2) return `${pair[0]} ↔ ${pair[1]}`;
      return String(pair);
    })
    .join(' · ');
}

export function ForexSessionsPanel(props: { sessions: unknown; holiday?: unknown; loading?: boolean }) {
  const snap = asSnapshot(props.sessions);
  const holidayReady = asHolidayReadiness(props.holiday);
  const eligibility = snap?.eligibility;
  const tradingOpen = eligibility?.open === true;
  const [tick, setTick] = useState(0);

  const activeSessions = useMemo(
    () => fmtList(eligibility?.sessions ?? (tradingOpen ? snap?.sessions : [])),
    [eligibility?.sessions, snap?.sessions, tradingOpen],
  );

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (props.loading && !snap) {
    return <KpiSkeleton count={2} />;
  }

  return (
    <div className="admin-stack-lg">
      <ForexPanelShell title="Session eligibility" description="Whether new Forex orders are accepted right now">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge variant={tradingOpen ? 'success' : 'danger'} className="font-normal">
            {tradingOpen ? 'Trading open' : 'Trading closed'}
          </Badge>
          {eligibility?.weekend ? <Badge variant="warning">Weekend</Badge> : null}
          {eligibility?.holiday ? <Badge variant="warning">Holiday</Badge> : null}
          {holidayReady?.coverage ? (
            <Badge variant={holidayReady.coverage === 'CONFIGURED' ? 'success' : 'warning'} className="font-normal">
              Holiday DB: {holidayReady.coverage}
            </Badge>
          ) : null}
        </div>
        {eligibility?.reason ? (
          <p className="mb-3 text-sm text-admin-muted">{String(eligibility.reason)}</p>
        ) : null}
        <ForexDetailGrid
          columns={3}
          items={[
            { label: 'Calendar', value: snap?.calendar?.name ?? '—' },
            { label: 'Timezone', value: snap?.calendar?.timezone ?? '—', mono: true },
            { label: 'Code', value: snap?.calendar?.code ?? '—', mono: true },
            { label: 'Active sessions (now)', value: activeSessions },
            { label: 'Session overlaps', value: fmtOverlapPairs(eligibility?.overlaps) },
            {
              label: 'Holiday coverage',
              value: snap?.holidayCoverage ? 'Configured' : 'Missing',
              highlight: snap?.holidayCoverage ? 'success' : 'warning',
            },
            {
              label: 'Holiday safe',
              value: snap?.holidaySafe ? 'Yes' : 'No',
              highlight: snap?.holidaySafe ? 'success' : 'warning',
            },
            { label: 'Session exceptions', value: String(snap?.exceptionsConfigured ?? 0) },
            { label: 'DST model', value: snap?.dstModel ?? '—' },
            { label: 'DST applied', value: snap?.dstApplied ? 'Yes' : 'No' },
            { label: 'Weekend TZ', value: snap?.weekendTimezone ?? '—', mono: true },
            { label: 'Valuation', value: snap?.valuationPolicy ?? '—', mono: true },
            { label: 'Data source', value: snap?.source ?? '—', mono: true },
          ]}
        />
      </ForexPanelShell>

      <ForexPanelShell title="Session clock" description="Major hub local hours · updates every minute">
        <ForexSessionTimeline tick={tick} />
      </ForexPanelShell>
    </div>
  );
}
