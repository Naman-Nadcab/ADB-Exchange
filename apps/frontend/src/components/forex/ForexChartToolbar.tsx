'use client';

import type { DrawingToolMode } from '@/components/trade/chart/extension/types';
import type { ForexExtraTool } from '@/lib/forex/chart/forex-drawings';
import { cn } from '@/lib/utils';

export type ForexAnalysisTool = DrawingToolMode | ForexExtraTool | 'measure' | 'rr' | 'alert';

type Props = {
  tool: ForexAnalysisTool;
  onTool: (t: ForexAnalysisTool) => void;
  showSessions: boolean;
  onSessions: (v: boolean) => void;
  showLevels: boolean;
  onLevels: (v: boolean) => void;
  showRsi: boolean;
  onRsi: (v: boolean) => void;
  showMacd: boolean;
  onMacd: (v: boolean) => void;
  showCalendar: boolean;
  onCalendar: (v: boolean) => void;
  showIntel: boolean;
  onIntel: (v: boolean) => void;
  onClearDrawings: () => void;
  showDrawings: boolean;
  onShowDrawings: (v: boolean) => void;
  rrSummary: string | null;
  measureSummary: string | null;
};

const DRAW_TOOLS: Array<{ id: ForexAnalysisTool; label: string }> = [
  { id: 'none', label: 'Select' },
  { id: 'hline', label: 'H-Line' },
  { id: 'vline', label: 'V-Line' },
  { id: 'trend', label: 'Trend' },
  { id: 'ray', label: 'Ray' },
  { id: 'extended', label: 'Extend' },
  { id: 'rect', label: 'Rect' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'fib2', label: 'Fib' },
  { id: 'measure', label: 'Measure' },
  { id: 'rr', label: 'R:R' },
  { id: 'alert', label: 'Alert' },
];

export function ForexChartToolbar(props: Props) {
  return (
    <div className="flex h-7 min-w-0 items-center gap-1 overflow-x-auto border-b border-border bg-card/80 px-1.5">
      <span className="shrink-0 text-[9px] uppercase tracking-wide text-muted-foreground">Draw</span>
      <div className="flex items-center gap-0.5" role="group" aria-label="Drawing tools">
        {DRAW_TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={props.tool === t.id}
            onClick={() => props.onTool(t.id)}
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              props.tool === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={props.onClearDrawings}
        className="ml-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Clear drawings
      </button>
      <Toggle label={props.showDrawings ? 'Hide drawings' : 'Show drawings'} pressed={!props.showDrawings} onClick={() => props.onShowDrawings(!props.showDrawings)} />

      <span className="mx-1 h-4 w-px shrink-0 bg-border" aria-hidden />

      <Toggle label="Sessions" pressed={props.showSessions} onClick={() => props.onSessions(!props.showSessions)} />
      <Toggle label="Levels" pressed={props.showLevels} onClick={() => props.onLevels(!props.showLevels)} />
      <Toggle label="RSI" pressed={props.showRsi} onClick={() => props.onRsi(!props.showRsi)} />
      <Toggle label="MACD" pressed={props.showMacd} onClick={() => props.onMacd(!props.showMacd)} />
      <Toggle label="Calendar" pressed={props.showCalendar} onClick={() => props.onCalendar(!props.showCalendar)} />
      <Toggle label="Intel" pressed={props.showIntel} onClick={() => props.onIntel(!props.showIntel)} />

      {props.rrSummary ? (
        <span className="ml-2 shrink-0 font-mono text-[10px] text-primary">{props.rrSummary}</span>
      ) : null}
      {props.measureSummary ? (
        <span className="ml-2 shrink-0 font-mono text-[10px] text-muted-foreground">{props.measureSummary}</span>
      ) : null}

      <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">LOCAL drawings · Del removes</span>
    </div>
  );
}

function Toggle(props: { label: string; pressed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={cn(
        'rounded px-1.5 py-0.5 text-[10px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        props.pressed ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {props.label}
    </button>
  );
}
