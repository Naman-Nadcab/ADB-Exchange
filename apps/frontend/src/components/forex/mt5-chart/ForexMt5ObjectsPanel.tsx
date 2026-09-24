'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

type Row = { key: string; kind: string; label: string; hidden?: boolean; locked?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  rows: Row[];
  onClearAll: () => void;
  onRefresh: () => void;
};

export function ForexMt5ObjectsPanel(props: Props) {
  const t = useTranslations('forex.mt5Chart.objects');
  if (!props.open) return null;

  return (
    <div className="absolute right-2 top-2 z-30 w-56 rounded border border-border bg-card/95 shadow-lg backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border px-2 py-1">
        <span className="text-[11px] font-semibold">{t('title')}</span>
        <button type="button" className="text-[10px] text-muted-foreground hover:text-foreground" onClick={props.onClose}>
          ×
        </button>
      </div>
      <div className="max-h-48 overflow-y-auto px-1 py-1">
        {props.rows.length === 0 ? (
          <p className="px-1 py-2 text-[10px] text-muted-foreground">{t('empty')}</p>
        ) : (
          props.rows.map((r) => (
            <div key={r.key} className="flex items-center gap-1 border-b border-border/40 py-1 text-[10px] last:border-0">
              <span className="flex-1 truncate font-mono">{r.label}</span>
              {r.hidden ? <span className="text-muted-foreground">{t('hidden')}</span> : null}
              {r.locked ? <span title={t('locked')}>🔒</span> : null}
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

export function parseDrawingRows(raw: unknown[]): Row[] {
  const out: Row[] = [];
  raw.forEach((item, idx) => {
    if (!item || typeof item !== 'object') return;
    const o = item as Record<string, unknown>;
    const kind = String(o.kind ?? o.type ?? 'object');
    const label = String(o.label ?? kind);
    out.push({
      key: `${kind}-${idx}`,
      kind,
      label,
      hidden: Boolean(o.hidden),
      locked: Boolean(o.locked),
    });
  });
  return out;
}
