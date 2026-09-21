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

  return (
    <div className={cn('space-y-3', props.compact ? 'text-[10px]' : 'text-[11px]')}>
      <div>
        <p className="font-semibold text-foreground">{tf('title')}</p>
        <p className="text-muted-foreground">{tf('intro')}</p>
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
        <div className="flex flex-wrap gap-2 rounded border border-border/60 bg-muted/20 px-2 py-1.5 font-mono text-[10px]">
          {delivery.map((d) => (
            <span key={String(d.channel)}>
              {d.channel}: {labelDeliveryAdapterStatus(d, tf)}
              {d.reason ? ` (${d.reason})` : ''}
            </span>
          ))}
        </div>
      ) : null}

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

      {alerts.length === 0 ? (
        <p className="text-muted-foreground">{tf('empty')}</p>
      ) : (
        <ul className="divide-y divide-border/70 rounded border border-border/60">
          {alerts.map((a) => (
            <li key={a.alertId} className="flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 font-mono text-[10px]">
              <span className={cn(!a.enabled && 'opacity-50')}>
                {a.symbol ?? '—'} · {labelForexServerAlertType(a.alertType, tf)} ·{' '}
                {describeAlertCondition(a.alertType, a.condition ?? {}, tf)}
                {a.lastTriggeredAt ? ` · last ${a.lastTriggeredAt}` : ''}
              </span>
              <span className="flex gap-2">
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
                  className="text-primary underline"
                  onClick={() => void forexApi.deleteAlert(a.alertId).then(() => reload())}
                >
                  {tf('delete')}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      <div>
        <p className="font-semibold text-foreground">{tf('eventsTitle')}</p>
        {events.length === 0 ? (
          <p className="text-muted-foreground">{tf('noEvents')}</p>
        ) : (
          <ul className="mt-1 max-h-40 overflow-auto divide-y divide-border/50 font-mono text-[10px]">
            {events.slice(0, 20).map((ev) => (
              <li key={ev.eventId} className="py-1">
                {ev.createdAt} · {ev.deliveryChannel} · {ev.status} · {ev.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
