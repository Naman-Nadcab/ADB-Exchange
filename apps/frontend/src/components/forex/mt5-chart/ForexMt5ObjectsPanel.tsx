'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import type { ForexDrawingObjectRef } from '../ForexLightweightChart';

export type ObjectPanelRow = ForexDrawingObjectRef & { key: string };

type Props = {
  open: boolean;
  onClose: () => void;
  rows: ObjectPanelRow[];
  onClearAll: () => void;
  onRefresh: () => void;
  onSelect: (row: ObjectPanelRow) => void;
  onDelete: (row: ObjectPanelRow) => void;
  onToggleHidden: (row: ObjectPanelRow) => void;
  onToggleLocked: (row: ObjectPanelRow) => void;
};

export function ForexMt5ObjectsPanel(props: Props) {
  const t = useTranslations('forex.mt5Chart.objects');
  if (!props.open) return null;

  return (
    <div className="absolute right-2 top-2 z-30 w-64 rounded border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[11px] font-semibold">{t('title')}</span>
        <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={props.onClose}>
          ×
        </button>
      </div>
      <div className="max-h-52 overflow-y-auto px-1 py-1">
        {props.rows.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-muted-foreground">{t('empty')}</p>
        ) : (
          props.rows.map((r) => (
            <div
              key={r.key}
              className="flex flex-wrap items-center gap-1 border-b border-border/40 py-1 text-[10px] last:border-0"
            >
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left font-mono hover:text-primary"
                title={t('select')}
                onClick={() => props.onSelect(r)}
              >
                {r.label}
              </button>
              <span className="text-[9px] uppercase text-muted-foreground">{r.kind}</span>
              {r.hidden ? <span className="text-muted-foreground">{t('hidden')}</span> : null}
              {r.locked ? <span title={t('locked')}>🔒</span> : null}
              <div className="flex w-full gap-0.5 pl-0.5">
                {r.layer === 'extra' ? (
                  <>
                    <MiniAct label={r.hidden ? t('show') : t('hide')} onClick={() => props.onToggleHidden(r)} />
                    <MiniAct label={r.locked ? t('unlock') : t('lock')} onClick={() => props.onToggleLocked(r)} />
                  </>
                ) : null}
                <MiniAct label={t('delete')} danger onClick={() => props.onDelete(r)} />
              </div>
            </div>
          ))
        )}
      </div>
      <div className="flex gap-1 border-t border-border p-1">
        <button type="button" className="flex-1 rounded bg-muted px-1 py-0.5 text-[10px]" onClick={props.onRefresh}>
          {t('refresh')}
        </button>
        <button type="button" className={cn('flex-1 rounded px-1 py-0.5 text-[10px] text-sell hover:bg-sell/10')} onClick={props.onClearAll}>
          {t('clearAll')}
        </button>
      </div>
      <p className="border-t border-border px-2 py-1 text-[9px] text-muted-foreground">{t('hint')}</p>
    </div>
  );
}

function MiniAct(props: { label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        'rounded px-1 py-0.5 text-[9px]',
        props.danger ? 'text-sell hover:bg-sell/10' : 'bg-muted/80 hover:bg-muted'
      )}
      onClick={props.onClick}
    >
      {props.label}
    </button>
  );
}

/** @deprecated Use listDrawingObjects from chart API */
export function parseDrawingRows(raw: unknown[]): ObjectPanelRow[] {
  const out: ObjectPanelRow[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const kind = String(o.kind ?? o.type ?? 'object');
    const label = String(o.label ?? kind);
    out.push({
      key: `legacy-${kind}-${idx}`,
      id: String(o.id ?? idx),
      layer: 'extra',
      kind,
      label,
      hidden: Boolean(o.hidden),
      locked: Boolean(o.locked),
    });
  });
  return out;
}

export function objectRowsFromApi(list: ForexDrawingObjectRef[]): ObjectPanelRow[] {
  return list.map((o) => ({ ...o, key: `${o.layer}:${o.id}` }));
}
