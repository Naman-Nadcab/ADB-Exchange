'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { ForexPositionModeSwitch } from './ForexPositionModeSwitch';
import { fxPlain } from './format';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import { syncForexAccountsFromServer } from '@/lib/forex/runtime/hydrate';

type GroupChoice = { groupId: string; code: string; label: string; leverage: string; positionMode: string };

export function ForexAccountSettingsPanel(props: {
  isSelected: boolean;
  accountId?: string;
  positionMode?: string;
  leverageLabel: string;
  groupLabel?: string | null;
  groupCode?: string | null;
  onChanged?: () => void;
}) {
  const t = useTranslations('forex.accountSettings');
  const [groups, setGroups] = useState<GroupChoice[]>([]);
  const [code, setCode] = useState(props.groupCode ?? '');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCode(props.groupCode ?? '');
  }, [props.groupCode]);

  useEffect(() => {
    if (!props.isSelected) return;
    void forexApi.accountGroups().then((raw) => {
      const res = unwrap(raw);
      if (res.ok) setGroups(res.data.groups ?? []);
    });
  }, [props.isSelected]);

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <dl className="mb-3 grid gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('leverage')}</dt>
          <dd className="mt-0.5">{props.leverageLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('accountGroup')}</dt>
          <dd className="mt-0.5">{props.groupLabel ? fxPlain(props.groupLabel) : t('groupDefault')}</dd>
        </div>
      </dl>
      {!props.isSelected ? (
        <p className="text-[12px] text-muted-foreground">{t('switchToEdit')}</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-muted-foreground">{t('positionModeHint')}</p>
          <ForexPositionModeSwitch />
          {props.accountId && groups.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="text-[11px] text-muted-foreground">
                {t('accountGroup')}
                <select
                  className="mt-1 block rounded border border-border bg-background px-2 py-1.5 text-[12px] text-foreground"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                >
                  {code && !groups.some((g) => g.code === code) ? <option value={code}>{props.groupLabel ?? code}</option> : null}
                  {groups.map((g) => (
                    <option key={g.groupId} value={g.code}>
                      {g.label} · 1:{g.leverage} · {g.positionMode}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                disabled={busy || !code || code === props.groupCode}
                className="inline-flex min-h-9 items-center rounded border border-border px-3 text-[12px] font-medium disabled:opacity-50"
                onClick={() => {
                  if (!props.accountId) return;
                  setBusy(true);
                  setError(null);
                  setNote(null);
                  void forexApi.assignAccountGroup(props.accountId, code).then(async (raw) => {
                    const res = unwrap(raw);
                    setBusy(false);
                    if (!res.ok) {
                      setError(res.error.message);
                      return;
                    }
                    setNote(t('groupSaved'));
                    await syncForexAccountsFromServer();
                    props.onChanged?.();
                  });
                }}
              >
                {busy ? t('groupSaving') : t('groupSave')}
              </button>
            </div>
          ) : null}
          {note ? <p className="mt-2 text-[12px] text-buy">{note}</p> : null}
          {error ? <p className="mt-2 text-[12px] text-sell">{error}</p> : null}
        </>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">{t('leverageRequestHint')}</p>
    </ForexPortalModuleCard>
  );
}
