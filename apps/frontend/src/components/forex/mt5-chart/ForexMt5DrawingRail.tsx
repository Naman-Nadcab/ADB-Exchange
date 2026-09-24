'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import {
  ArrowUpRight,
  Circle,
  Crosshair,
  GitBranch,
  Layers,
  Minus,
  MoveHorizontal,
  MoveVertical,
  Ruler,
  Square,
  TrendingUp,
  Type,
} from 'lucide-react';
import type { ForexAnalysisTool } from '../ForexChartToolbar';
import { cn } from '@/lib/utils';

type ToolDef = { id: ForexAnalysisTool; icon: ReactNode; labelKey: string };

const TOOL_TEST_ID: Partial<Record<ForexAnalysisTool, string>> = {
  none: 'crosshair',
  measure: 'measure',
  trend: 'trend',
  ray: 'ray',
  hline: 'horizontal',
  vline: 'vertical',
  channel: 'channel',
  fib: 'fibonacci',
  fibext: 'fibonacci-extension',
  rect: 'rectangle',
  text: 'text',
};

const LINE_GROUP: ToolDef[] = [
  { id: 'trend', icon: <TrendingUp className="h-3.5 w-3.5" />, labelKey: 'trend' },
  { id: 'ray', icon: <ArrowUpRight className="h-3.5 w-3.5" />, labelKey: 'ray' },
  { id: 'hline', icon: <Minus className="h-3.5 w-3.5" />, labelKey: 'hline' },
  { id: 'vline', icon: <MoveVertical className="h-3.5 w-3.5" />, labelKey: 'vline' },
];

const CHANNEL_GROUP: ToolDef[] = [
  { id: 'channel', icon: <Layers className="h-3.5 w-3.5" />, labelKey: 'channel' },
  { id: 'regchannel', icon: <Layers className="h-3.5 w-3.5" />, labelKey: 'regchannel' },
];

const FIB_GROUP: ToolDef[] = [
  { id: 'fib', icon: <GitBranch className="h-3.5 w-3.5" />, labelKey: 'fib' },
  { id: 'fib2', icon: <GitBranch className="h-3.5 w-3.5" />, labelKey: 'fib2' },
  { id: 'fibext', icon: <GitBranch className="h-3.5 w-3.5" />, labelKey: 'fibext' },
  { id: 'fibexp', icon: <GitBranch className="h-3.5 w-3.5" />, labelKey: 'fibexp' },
];

const SHAPE_GROUP: ToolDef[] = [
  { id: 'rect', icon: <Square className="h-3.5 w-3.5" />, labelKey: 'rect' },
  { id: 'ellipse', icon: <Circle className="h-3.5 w-3.5" />, labelKey: 'ellipse' },
  { id: 'triangle', icon: <Square className="h-3.5 w-3.5 rotate-45" />, labelKey: 'triangle' },
];

const ANNOT_GROUP: ToolDef[] = [
  { id: 'text', icon: <Type className="h-3.5 w-3.5" />, labelKey: 'text' },
  { id: 'arrow', icon: <ArrowUpRight className="h-3.5 w-3.5" />, labelKey: 'arrow' },
];

type Props = {
  tool: ForexAnalysisTool;
  onTool: (t: ForexAnalysisTool) => void;
  onObjects: () => void;
  objectsOpen: boolean;
  measureSummary: string | null;
};

export function ForexMt5DrawingRail(props: Props) {
  const t = useTranslations('forex.mt5Chart.rail');
  const tc = useTranslations('forex.chartToolbar.tools');
  const [flyout, setFlyout] = useState<'lines' | 'channels' | 'fib' | 'shapes' | 'annot' | null>(null);

  const groups = useMemo(
    () =>
      [
        { id: 'lines' as const, icon: <TrendingUp className="h-3.5 w-3.5" />, title: t('groupLines'), items: LINE_GROUP },
        { id: 'channels' as const, icon: <Layers className="h-3.5 w-3.5" />, title: t('groupChannels'), items: CHANNEL_GROUP },
        { id: 'fib' as const, icon: <GitBranch className="h-3.5 w-3.5" />, title: t('groupFib'), items: FIB_GROUP },
        { id: 'shapes' as const, icon: <Square className="h-3.5 w-3.5" />, title: t('groupShapes'), items: SHAPE_GROUP },
        { id: 'annot' as const, icon: <Type className="h-3.5 w-3.5" />, title: t('groupAnnot'), items: ANNOT_GROUP },
      ],
    [t]
  );

  const pick = (id: ForexAnalysisTool) => {
    props.onTool(id);
    setFlyout(null);
  };

  return (
    <div
      className="fx-mt5-rail flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-card/90 py-1"
      role="toolbar"
      aria-label={t('aria')}
    >
      <RailBtn
        pressed={props.tool === 'none'}
        title={t('crosshair')}
        testId="drawing-tool-crosshair"
        onClick={() => pick('none')}
        icon={<Crosshair className="h-3.5 w-3.5" />}
      />
      <RailBtn
        title={t('measure')}
        pressed={props.tool === 'measure'}
        testId="drawing-tool-measure"
        onClick={() => pick('measure')}
        icon={<Ruler className="h-3.5 w-3.5" />}
      />

      {groups.map((g) => (
        <div key={g.id} className="relative">
          <RailBtn
            title={g.title}
            testId={`drawing-group-${g.id}`}
            pressed={g.items.some((x) => x.id === props.tool)}
            onClick={() => setFlyout((cur) => (cur === g.id ? null : g.id))}
            icon={g.icon}
          />
          {flyout === g.id ? (
            <div className="absolute left-full top-0 z-50 ml-1 flex min-w-[120px] flex-col rounded border border-border bg-card py-1 shadow-lg">
              {g.items.map((item) => (
                <button
                  key={`${g.id}-${item.id}-${item.labelKey}`}
                  type="button"
                  data-testid={`drawing-tool-${TOOL_TEST_ID[item.id] ?? item.id}`}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1 text-left text-[11px] hover:bg-muted',
                    props.tool === item.id && 'bg-primary/15 text-foreground'
                  )}
                  onClick={() => pick(item.id)}
                >
                  {item.icon}
                  <span>{tc(item.id as 'none')}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ))}

      <div className="mt-auto flex flex-col gap-0.5">
        <RailBtn
          title={t('objects')}
          testId="drawing-object-manager-toggle"
          pressed={props.objectsOpen}
          onClick={props.onObjects}
          icon={<Layers className="h-3.5 w-3.5" />}
        />
      </div>
      {props.measureSummary ? (
        <span className="max-w-[2rem] truncate text-[8px] leading-tight text-muted-foreground" title={props.measureSummary}>
          {props.measureSummary.slice(0, 12)}
        </span>
      ) : null}
    </div>
  );
}

function RailBtn(props: {
  icon: React.ReactNode;
  title: string;
  testId?: string;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={props.title}
      data-testid={props.testId}
      aria-pressed={props.pressed}
      onClick={props.onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        props.pressed && 'bg-primary/20 text-primary'
      )}
    >
      {props.icon}
    </button>
  );
}
