'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from './ForexPortalKpiCard';
import { forexApi, unwrap } from '@/lib/forex/api/client';

type Method = { id: string; label: string; rail: string };

export function ForexPaymentMethodsList() {
  const t = useTranslations('forex.paymentMethodsList');
  const [methods, setMethods] = useState<Method[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    void (async () => {
      const res = unwrap(await forexApi.getForexPaymentMethods());
      if (!res.ok) {
        setErr(res.error.message);
        setLoaded(true);
        return;
      }
      setMethods(res.data.methods ?? []);
      setLoaded(true);
    })();
  }, []);

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      {err ? <p className="text-sm text-sell">{err}</p> : null}
      {!loaded && !err ? <p className="text-sm text-muted-foreground">{t('loading')}</p> : null}
      {loaded && !err && methods.length === 0 ? <p className="text-sm text-muted-foreground">{t('empty')}</p> : null}
      <ul className="space-y-2">
        {methods.map((method) => (
          <li key={method.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 px-3 py-2">
            <div>
              <p className="text-[12px] font-medium">{method.label}</p>
              <p className="font-mono text-[11px] text-muted-foreground">{method.id}</p>
            </div>
            <ForexPortalStatusBadge tone="success">
              {t('rail')}: {method.rail}
            </ForexPortalStatusBadge>
          </li>
        ))}
      </ul>
    </ForexPortalModuleCard>
  );
}
