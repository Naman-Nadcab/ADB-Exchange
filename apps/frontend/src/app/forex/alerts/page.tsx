'use client';

import Link from 'next/link';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexServerAlertsPanel } from '@/components/forex/ForexServerAlertsPanel';
import { FOREX_ROUTES } from '@/lib/forex/routes';

export default function ForexAlertsPage() {
  return (
    <ForexPageFrame title="Alerts" subtitle="Server-evaluated Forex alerts for your account." wide>
      <div className="mx-auto max-w-3xl space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Primary trading alerts are managed here and in the{' '}
          <Link href={FOREX_ROUTES.trade} className="text-primary underline">
            trade terminal
          </Link>{' '}
          (Alerts tab). PUSH, EMAIL, and WEBHOOK channels show as not configured until providers are enabled on the
          server.
        </p>
        <div className="eda-card p-3">
          <ForexServerAlertsPanel />
        </div>
        <p className="text-[11px] text-muted-foreground">
          <span className="rounded border border-amber-800/60 bg-amber-950/30 px-1.5 py-0.5 font-mono text-[10px] uppercase text-amber-200">
            Local only
          </span>{' '}
          Browser-only price alerts (tab must stay open) remain on the trade terminal Alerts tab — they are not stored on
          the server.
        </p>
      </div>
    </ForexPageFrame>
  );
}
