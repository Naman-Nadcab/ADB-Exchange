'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { forexApi, unwrap } from '@/lib/forex/api/client';
import {
  FOREX_SERVER_ALERT_TYPES,
  type ForexServerAlertEvent,
  type ForexServerAlertRow,
  type ForexServerAlertType,
  alertTypeNeedsPrice,
  alertTypeNeedsSymbol,
  alertTypeNeedsThreshold,
  alertFormFromRow,
  buildAlertCreateBody,
  buildAlertPatchBody,
  describeAlertCondition,
  labelForexServerAlertType,
  labelDeliveryAdapterStatus,
  validateAlertFormInput,
} from '@/lib/forex/models/customer-alerts';
import { useForexPrivateSession } from '@/lib/forex/runtime/useForexSession';
import { useForexStore } from '@/lib/forex/state/store';
import { cn } from '@/lib/utils';
import { ForexPortalModuleCard, ForexPortalStatusBadge } from '@/components/forex/ForexPortalKpiCard';

type Props = {
  compact?: boolean;
  symbolOptions?: string[];
};

export function ForexServerAlertsPanel(props: Props) {
  const tf = useTranslations('forex.serverAlerts');
  const authed = useForexPrivateSession();
  const instruments = useForexStore((s) => s.instruments);
  const symbols = useMemo(
    () => props.symbolOptions ?? Object.keys(instruments).slice(0, 24),
    [instruments, props.symbolOptions]
  );

  const [alerts, setAlerts] = useState<ForexServerAlertRow[]>([]);
  const [events, setEvents] = useState<ForexServerAlertEvent[]>([]);
  const [delivery, setDelivery] = useState<
    Array<{ channel?: string; configured?: boolean; available?: boolean; reason?: string }>
  >([]);
  const [err, setErr] = useState<string | null>(null);

  const [alertType, setAlertType] = useState<ForexServerAlertType>('BID');
  const [symbol, setSymbol] = useState('EURUSD');
  const [side, setSide] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState('');
  const [threshold, setThreshold] = useState('');
  const [editingAlertId, setEditingAlertId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!authed) {
      setAlerts([]);
      setEvents([]);
      setDelivery([]);
      return;
    }
    setLoading(true);
    try {
      const [aRes, eRes, dRes] = await Promise.all([
        forexApi.listAlerts(),
        forexApi.alertEvents(),
        forexApi.alertDeliveryStatus(),
      ]);
      const a = unwrap(aRes);
      if (!a.ok) {
        setErr(a.error.message);
        return;
      }
      setErr(null);
      setAlerts(((a.data as { alerts?: ForexServerAlertRow[] }).alerts ?? []) as ForexServerAlertRow[]);
      const e = unwrap(eRes);
      if (e.ok) {
        const raw = (e.data as { events?: unknown[] }).events ?? [];
        setEvents(
          raw.map((row) => {
            const r = row as Record<string, unknown>;
            return {
              eventId: String(r.eventId ?? r.event_id ?? ''),
              alertId: String(r.alertId ?? r.alert_id ?? ''),
              deliveryChannel: String(r.deliveryChannel ?? r.delivery_channel ?? ''),
              status: String(r.status ?? ''),
              message: String(r.message ?? ''),
              createdAt: String(r.createdAt ?? r.created_at ?? ''),
            };
          })
        );
      }
      const d = unwrap(dRes);
      if (d.ok) {
        setDelivery((d.data as { adapters?: typeof delivery }).adapters ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [authed]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const formFields = () => ({
    alertType,
    symbol: alertTypeNeedsSymbol(alertType) ? symbol : null,
    side,
    price,
    threshold,
  });

  const create = async () => {
    const fields = formFields();
    const v = validateAlertFormInput(fields);
    if (!v.ok) {
      setErr(tf(v.messageKey));
      return;
    }
    const body = buildAlertCreateBody(fields);
    const res = await forexApi.createAlert(body);
    const u = unwrap(res);
    if (!u.ok) {
      setErr(u.error.message);
      return;
    }
    setPrice('');
    setThreshold('');
    setEditingAlertId(null);
    await reload();
  };

  const startEdit = (row: ForexServerAlertRow) => {
    const f = alertFormFromRow(row);
    setEditingAlertId(row.alertId);
    setAlertType(f.alertType);
    setSymbol(f.symbol ?? 'EURUSD');
    setSide(f.side);
    setPrice(f.price);
    setThreshold(f.threshold);
    setErr(null);
  };

  const cancelEdit = () => {
    setEditingAlertId(null);
    setAlertType('BID');
    setPrice('');
    setThreshold('');
    setErr(null);
  };

  const saveEdit = async () => {
    if (!editingAlertId) return;
    const fields = formFields();
    const v = validateAlertFormInput(fields);
    if (!v.ok) {
      setErr(tf(v.messageKey));
      return;
    }
    const res = await forexApi.patchAlert(editingAlertId, buildAlertPatchBody(fields));
    const u = unwrap(res);
    if (!u.ok) {
      setErr(u.error.message);
      return;
    }
    cancelEdit();
    await reload();
  };

  if (!authed) {
    return (
      <p className="text-[11px] text-muted-foreground">
        <Link href="/login" className="text-primary underline">
          {tf('signInPrefix')}
        </Link>{' '}
        {tf('signInSuffix')}
      </p>
    );
  }

  const enabledCount = alerts.filter((a) => a.enabled).length;

  return (
    <div className={cn('space-y-3', props.compact ? 'text-[10px]' : 'text-[11px]')}>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded border border-border/80 bg-card/80 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tf('statusActiveCount')}</p>
          <p className="mt-1 font-mono text-[18px] tabular-nums text-foreground">{enabledCount}</p>
        </div>
        <div className="rounded border border-border/80 bg-card/80 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tf('statusTotalCount')}</p>
          <p className="mt-1 font-mono text-[18px] tabular-nums text-foreground">{alerts.length}</p>
        </div>
        <div className="rounded border border-border/80 bg-card/80 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{tf('statusEventsCount')}</p>
          <p className="mt-1 font-mono text-[18px] tabular-nums text-foreground">{events.length}</p>
        </div>
      </div>

      {err ? (
        <p className="text-destructive" role="alert">
          {err}
        </p>
      ) : null}
      {loading ? (
        <p className="text-muted-foreground" aria-live="polite">
          {tf('loading')}
        </p>
      ) : null}

      {delivery.length > 0 ? (
        <ForexPortalModuleCard title={tf('deliveryHeading')} subtitle={tf('intro')}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {delivery.map((d) => {
              const available = d.available === true;
              return (
                <li key={String(d.channel)} className="flex items-center justify-between gap-2 rounded border border-border/70 bg-muted/10 px-2.5 py-2">
                  <span className="font-medium uppercase tracking-wide text-foreground">{String(d.channel ?? '—')}</span>
                  <ForexPortalStatusBadge tone={available ? 'success' : 'warning'}>
                    {labelDeliveryAdapterStatus(d, tf)}
                  </ForexPortalStatusBadge>
                </li>
              );
            })}
          </ul>
          {delivery.some((d) => d.reason) ? (
            <p className="mt-2 text-[10px] text-muted-foreground">{tf('deliveryReasonHint')}</p>
          ) : null}
        </ForexPortalModuleCard>
      ) : (
        <p className="text-muted-foreground">{tf('intro')}</p>
      )}

      <ForexPortalModuleCard title={tf('formHeading')}>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-0.5">
          {tf('typeLabel')}
          <select
            aria-label={tf('typeAria')}
            className="h-8 min-w-[140px] rounded border border-border bg-background px-2"
            value={alertType}
            onChange={(e) => setAlertType(e.target.value as ForexServerAlertType)}
          >
            {FOREX_SERVER_ALERT_TYPES.map((typeCode) => (
              <option key={typeCode} value={typeCode}>
                {labelForexServerAlertType(typeCode, tf)}
              </option>
            ))}
          </select>
        </label>
        {alertTypeNeedsSymbol(alertType) ? (
          <label className="flex flex-col gap-0.5">
            {tf('symbolLabel')}
            <select
              aria-label={tf('symbolAria')}
              className="h-8 rounded border border-border bg-background px-2"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
            >
              {symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {alertTypeNeedsPrice(alertType) || alertTypeNeedsThreshold(alertType) ? (
          <label className="flex flex-col gap-0.5">
            {tf('sideLabel')}
            <select
              aria-label={tf('sideAria')}
              className="h-8 rounded border border-border bg-background px-2"
              value={side}
              onChange={(e) => setSide(e.target.value as 'above' | 'below')}
            >
              <option value="above">{tf('sideAbove')}</option>
              <option value="below">{tf('sideBelow')}</option>
            </select>
          </label>
        ) : null}
        {alertTypeNeedsPrice(alertType) ? (
          <label className="flex flex-col gap-0.5">
            {tf('priceLabel')}
            <input
              aria-label={tf('priceAria')}
              className="h-8 w-28 rounded border border-border bg-background px-2 font-mono"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="1.0850"
            />
          </label>
        ) : null}
        {alertTypeNeedsThreshold(alertType) ? (
          <label className="flex flex-col gap-0.5">
            {tf('thresholdLabel')}
            <input
              aria-label={tf('thresholdAria')}
              className="h-8 w-24 rounded border border-border bg-background px-2 font-mono"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder={alertType === 'SPREAD' ? '0.0002' : '100'}
            />
          </label>
        ) : null}
        {editingAlertId ? (
          <>
            <button
              type="button"
              className="h-8 rounded border border-border px-3 text-[11px]"
              onClick={() => cancelEdit()}
            >
              {tf('cancelEdit')}
            </button>
            <button
              type="button"
              className="h-8 rounded bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
              onClick={() => void saveEdit()}
            >
              {tf('save')}
            </button>
          </>
        ) : (
          <button
            type="button"
            className="h-8 rounded bg-primary px-3 text-[11px] font-semibold text-primary-foreground"
            onClick={() => void create()}
          >
            {tf('create')}
          </button>
        )}
      </div>
      {editingAlertId ? (
        <p className="font-mono text-[10px] text-amber-200/90">{tf('editing', { id: editingAlertId.slice(0, 8) })}</p>
      ) : null}
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title={tf('activeHeading')}>
      {alerts.length === 0 ? (
        <p className="text-muted-foreground">{tf('empty')}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.alertId}
              className={cn(
                'flex flex-wrap items-center justify-between gap-2 rounded border border-border/70 px-2.5 py-2',
                !a.enabled && 'opacity-60'
              )}
            >
              <div className="min-w-0 font-mono text-[10px]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <ForexPortalStatusBadge tone={a.enabled ? 'success' : 'neutral'}>
                    {a.enabled ? tf('statusEnabled') : tf('statusDisabled')}
                  </ForexPortalStatusBadge>
                  <span className="font-semibold text-foreground">{labelForexServerAlertType(a.alertType, tf)}</span>
                  {a.symbol ? <span className="text-primary">{a.symbol}</span> : null}
                </div>
                <p className="mt-1 text-muted-foreground">{describeAlertCondition(a.alertType, a.condition ?? {}, tf)}</p>
                {a.lastTriggeredAt ? (
                  <p className="mt-0.5 text-[9px] text-muted-foreground">{tf('lastTriggered', { time: a.lastTriggeredAt })}</p>
                ) : null}
              </div>
              <span className="flex shrink-0 gap-2">
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => startEdit(a)}
                  disabled={editingAlertId != null && editingAlertId !== a.alertId}
                >
                  {tf('edit')}
                </button>
                <button
                  type="button"
                  className="text-primary underline"
                  onClick={() => void forexApi.patchAlert(a.alertId, { enabled: !a.enabled }).then(() => reload())}
                >
                  {a.enabled ? tf('disable') : tf('enable')}
                </button>
                <button
                  type="button"
                  className="text-destructive underline"
                  onClick={() => void forexApi.deleteAlert(a.alertId).then(() => reload())}
                >
                  {tf('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      </ForexPortalModuleCard>

      <ForexPortalModuleCard title={tf('eventsTitle')}>
        {events.length === 0 ? (
          <p className="text-muted-foreground">{tf('noEvents')}</p>
        ) : (
          <ul className="max-h-48 space-y-2 overflow-auto">
            {events.slice(0, 20).map((ev) => (
              <li key={ev.eventId} className="rounded border border-border/60 bg-muted/10 px-2 py-1.5 font-mono text-[10px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground">{ev.createdAt}</span>
                  <ForexPortalStatusBadge tone="neutral">{ev.deliveryChannel}</ForexPortalStatusBadge>
                  <ForexPortalStatusBadge tone={ev.status.toUpperCase() === 'FAILED' ? 'danger' : 'success'}>{ev.status}</ForexPortalStatusBadge>
                </div>
                <p className="mt-1 text-foreground">{ev.message}</p>
              </li>
            ))}
          </ul>
        )}
      </ForexPortalModuleCard>
    </div>
  );
}
