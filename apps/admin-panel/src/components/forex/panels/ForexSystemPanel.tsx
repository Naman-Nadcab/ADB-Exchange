'use client';

import type { ForexAdminConfigResponse, ForexAdminSystemResponse } from '@/lib/admin/forex-api';
import { ForexDetailGrid } from '@/components/forex/primitives/ForexDetailGrid';
import { ForexMetricTile } from '@/components/forex/primitives/ForexMetricTile';
import { ForexPanelShell } from '@/components/forex/primitives/ForexPanelShell';
import { Cpu, Database, Radio } from 'lucide-react';

export function ForexSystemPanel(props: {
  system: ForexAdminSystemResponse | undefined;
  config: ForexAdminConfigResponse | undefined;
  loading?: boolean;
}) {
  const md = props.system?.marketData ?? props.config?.runtime.marketData;
  const ready = props.system?.readiness ?? props.config?.readiness;

  return (
    <div className="admin-stack-lg">
      <section className="grid gap-3 sm:grid-cols-3">
        <ForexMetricTile
          label="Economic hydration"
          value={ready?.economicReady ? 'Ready' : 'Blocked'}
          tone={ready?.economicReady ? 'success' : 'danger'}
          hint={ready?.reason ?? undefined}
          icon={Database}
        />
        <ForexMetricTile
          label="Symbols loaded"
          value={props.config?.runtime.symbolCount ?? md?.symbols ?? '—'}
          icon={Cpu}
        />
        <ForexMetricTile
          label="Quote worker"
          value={md?.running ? 'Running' : 'Stopped'}
          tone={md?.running ? 'success' : 'warning'}
          icon={Radio}
        />
      </section>

      <ForexPanelShell title="Readiness detail">
        <ForexDetailGrid
          items={[
            {
              label: 'Economic ready',
              value: ready?.economicReady ? 'Yes' : 'No',
              highlight: ready?.economicReady ? 'success' : 'danger',
            },
            { label: 'Reason', value: ready?.reason ?? '—' },
            { label: 'Position mode', value: props.config?.runtime.positionMode ?? '—' },
            {
              label: 'Live money path',
              value: props.config?.runtime.realForex ? 'Armed — real forex enabled' : 'Blocked — simulated only',
              highlight: props.config?.runtime.realForex ? 'danger' : 'success',
            },
          ]}
        />
      </ForexPanelShell>

      {md ? (
        <ForexPanelShell title="Market data runtime">
          <ForexDetailGrid
            columns={3}
            items={[
              { label: 'Enabled', value: md.enabled ? 'Yes' : 'No' },
              { label: 'Running', value: md.running ? 'Yes' : 'No', highlight: md.running ? 'success' : 'warning' },
              { label: 'Interval', value: `${md.intervalMs} ms`, mono: true },
              {
                label: 'Source',
                value: md.source?.toUpperCase().includes('MOCK') ? `Mock (${md.source})` : md.source,
              },
              { label: 'Symbol count', value: md.symbols },
              { label: 'Providers', value: md.providers?.join(', ') ?? '—', mono: true },
            ]}
          />
        </ForexPanelShell>
      ) : null}

    </div>
  );
}
