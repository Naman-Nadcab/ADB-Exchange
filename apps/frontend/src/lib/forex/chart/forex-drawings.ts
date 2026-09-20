/**
 * Forex-only drawing layer. Does not modify Crypto DrawingToolManager.
 * Supports ray, extended line, rectangle, arrow, two-anchor Fibonacci retracement,
 * parallel channel, text note, support/resistance level and Fibonacci extension.
 */

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export type ForexExtraTool =
  | 'none'
  | 'ray'
  | 'extended'
  | 'rect'
  | 'arrow'
  | 'fib2'
  | 'channel'
  | 'text'
  | 'sr'
  | 'fibext'
  | 'fibexp'
  | 'fibtime'
  | 'fibchan'
  | 'regchannel'
  | 'gannfan'
  | 'ganngrid'
  | 'gannline'
  | 'ellipse'
  | 'triangle'
  | 'polygon'
  | 'pricelabel'
  | 'callout';

export type ForexExtraKind = Exclude<ForexExtraTool, 'none'>;

export type ForexSerializedExtra =
  | {
      kind:
        | 'ray'
        | 'extended'
        | 'rect'
        | 'arrow'
        | 'fib2'
        | 'fibexp'
        | 'fibtime'
        | 'gannline'
        | 'ellipse'
        | 'pricelabel'
        | 'callout';
      t1: number;
      p1: number;
      t2: number;
      p2: number;
      label?: string;
      hidden?: boolean;
      locked?: boolean;
    }
  | {
      kind: 'channel' | 'fibext' | 'fibchan' | 'regchannel' | 'triangle' | 'polygon';
      t1: number;
      p1: number;
      t2: number;
      p2: number;
      t3: number;
      p3: number;
      t4?: number;
      p4?: number;
      label?: string;
      hidden?: boolean;
      locked?: boolean;
    }
  | { kind: 'text'; t1: number; p1: number; t2: number; p2: number; label: string; hidden?: boolean; locked?: boolean }
  | { kind: 'sr'; t1: number; p1: number; t2: number; p2: number; label?: string; hidden?: boolean; locked?: boolean };

const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
/** Extension projects beyond 1 — the retracement tool (fib2) stays 0–1. */
const FIB_EXT_RATIOS = [0, 0.618, 1, 1.272, 1.618, 2, 2.618];
const FIB_EXPANSION_RATIOS = [0, 0.618, 1, 1.618, 2.618, 4.236];
const FIB_TIME_RATIOS = [0, 0.382, 0.5, 0.618, 1];

/** Clicks required before an item is committed. */
const ANCHORS: Record<ForexExtraKind, 1 | 2 | 3 | 4> = {
  ray: 2,
  extended: 2,
  rect: 2,
  arrow: 2,
  fib2: 2,
  fibexp: 2,
  fibtime: 2,
  channel: 3,
  fibext: 3,
  fibchan: 3,
  regchannel: 3,
  gannfan: 2,
  ganngrid: 2,
  gannline: 2,
  ellipse: 2,
  triangle: 3,
  polygon: 4,
  text: 1,
  sr: 1,
  pricelabel: 1,
  callout: 2,
};

const HIT = 8;
const HANDLE = 6;

let idSeq = 0;

function id(): string {
  const c = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  return `fxd-${Date.now()}-${++idSeq}`;
}

function clipLine(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  h: number,
  mode: 'segment' | 'ray' | 'extended'
): [number, number, number, number] | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return null;
  const ts: number[] = [];
  const consider = (t: number, nx: number, ny: number) => {
    if (nx < -1 || nx > w + 1 || ny < -1 || ny > h + 1) return;
    if (mode === 'segment' && (t < -1e-6 || t > 1 + 1e-6)) return;
    if (mode === 'ray' && t < -1e-6) return;
    ts.push(t);
  };
  if (Math.abs(dx) > 1e-9) {
    consider((0 - x1) / dx, 0, y1 + ((0 - x1) / dx) * dy);
    consider((w - x1) / dx, w, y1 + ((w - x1) / dx) * dy);
  }
  if (Math.abs(dy) > 1e-9) {
    consider((0 - y1) / dy, x1 + ((0 - y1) / dy) * dx, 0);
    consider((h - y1) / dy, x1 + ((h - y1) / dy) * dx, h);
  }
  ts.sort((a, b) => a - b);
  if (ts.length < 2) {
    if (mode === 'segment') return [x1, y1, x2, y2];
    return null;
  }
  const a = ts[0]!;
  const b = ts[ts.length - 1]!;
  return [x1 + a * dx, y1 + a * dy, x1 + b * dx, y1 + b * dy];
}

type Item = {
  id: string;
  kind: ForexExtraKind;
  t1: number;
  p1: number;
  t2: number;
  p2: number;
  t3?: number;
  p3?: number;
  t4?: number;
  p4?: number;
  label?: string;
  hidden?: boolean;
  locked?: boolean;
};

type Handle = 0 | 1 | 2 | 3;

/** Price offset that turns the base trend line into the parallel channel line. */
function channelOffset(it: Item): number {
  const t3 = it.t3 ?? it.t2;
  const p3 = it.p3 ?? it.p2;
  const span = it.t2 - it.t1;
  if (Math.abs(span) < 1e-9) return p3 - it.p1;
  return p3 - (it.p1 + ((t3 - it.t1) / span) * (it.p2 - it.p1));
}

function textWidth(label: string): number {
  return Math.max(16, label.length * 6 + 10);
}

export class ForexDrawingEngine {
  private chart: IChartApi;
  private series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>;
  private root: HTMLElement;
  /** Interactive ancestor — receives capture clicks so Select mode can grab items. */
  private surface: HTMLElement;
  private svg: SVGSVGElement;
  private place: HTMLDivElement;
  private mode: ForexExtraTool = 'none';
  private selectEnabled = true;
  private items: Item[] = [];
  private undoStack: Item[][] = [];
  private redoStack: Item[][] = [];
  private pending: Array<{ t: number; p: number }> = [];
  private selected: string | null = null;
  private drag: { id: string; handle: Handle; lastX: number; lastY: number } | null = null;
  private mutate: (() => void) | null = null;
  private unsub: (() => void) | null = null;
  private ro: ResizeObserver | null = null;

  constructor(
    chart: IChartApi,
    series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>,
    host: HTMLElement
  ) {
    this.chart = chart;
    this.series = series;
    this.root = host;
    this.surface = host.parentElement ?? host;
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:3;';
    this.place = document.createElement('div');
    this.place.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;';
    this.root.appendChild(this.svg);
    this.root.appendChild(this.place);
    this.place.addEventListener('mousedown', this.onDown);
    this.surface.addEventListener('mousedown', this.onSelectDown, true);
    window.addEventListener('keydown', this.onKey, true);
    const redraw = () => this.redraw();
    this.chart.timeScale().subscribeVisibleTimeRangeChange(redraw);
    this.unsub = () => this.chart.timeScale().unsubscribeVisibleTimeRangeChange(redraw);
    this.ro = new ResizeObserver(redraw);
    this.ro.observe(this.root);
  }

  setMutateCallback(cb: (() => void) | null): void {
    this.mutate = cb;
  }

  setMode(mode: ForexExtraTool): void {
    this.mode = mode;
    this.pending = [];
    this.place.style.pointerEvents = mode === 'none' ? 'none' : 'auto';
    this.place.style.cursor = mode === 'none' ? 'default' : 'crosshair';
    this.redraw();
  }

  /** Select/move of existing items is only claimed when no other tool owns the click. */
  setSelectEnabled(enabled: boolean): void {
    this.selectEnabled = enabled;
    if (!enabled && this.selected) {
      this.selected = null;
      this.redraw();
    }
  }

  serialize(): ForexSerializedExtra[] {
    return this.items.map((it): ForexSerializedExtra => {
      const meta = { hidden: it.hidden || undefined, locked: it.locked || undefined };
      const base = { t1: it.t1, p1: it.p1, t2: it.t2, p2: it.p2, ...meta };
      const multi = ['channel', 'fibext', 'fibchan', 'regchannel', 'triangle', 'polygon'] as const;
      if (multi.includes(it.kind as (typeof multi)[number])) {
        const row = {
          kind: it.kind as (typeof multi)[number],
          ...base,
          t3: it.t3 ?? it.t2,
          p3: it.p3 ?? it.p2,
          ...(it.kind === 'polygon' && it.t4 != null && it.p4 != null ? { t4: it.t4, p4: it.p4 } : {}),
        };
        return row as ForexSerializedExtra;
      }
      if (it.kind === 'text') return { kind: 'text', ...base, label: it.label ?? '' };
      if (it.kind === 'sr' || it.kind === 'pricelabel')
        return it.label ? { kind: it.kind, ...base, label: it.label } : { kind: it.kind, ...base };
      if (it.kind === 'callout') return { kind: 'callout', ...base, label: it.label ?? 'Note' };
      return { kind: it.kind, ...base, ...(it.label ? { label: it.label } : {}) } as ForexSerializedExtra;
    });
  }

  /** Tolerant of payloads written before channel/text/sr/fibext existed. */
  load(payload: ForexSerializedExtra[]): void {
    this.items = (Array.isArray(payload) ? payload : [])
      .filter((d): d is ForexSerializedExtra => {
        if (!d || typeof d !== 'object') return false;
        if (!(d.kind in ANCHORS)) return false;
        if (![d.t1, d.p1, d.t2, d.p2].every(Number.isFinite)) return false;
        const need3 = ['channel', 'fibext', 'fibchan', 'regchannel', 'triangle'] as const;
        if (need3.includes(d.kind as (typeof need3)[number])) {
          const row = d as { t3?: number; p3?: number };
          return Number.isFinite(row.t3) && Number.isFinite(row.p3);
        }
        if (d.kind === 'polygon') {
          const row = d as { t3?: number; p3?: number; t4?: number; p4?: number };
          return (
            Number.isFinite(row.t3) &&
            Number.isFinite(row.p3) &&
            Number.isFinite(row.t4) &&
            Number.isFinite(row.p4)
          );
        }
        if (d.kind === 'text') return typeof d.label === 'string' && d.label.length > 0;
        if (d.kind === 'callout') return typeof d.label === 'string';
        return true;
      })
      .map((d) => ({ id: id(), ...d }));
    this.redraw();
  }

  clearAll(): void {
    this.items = [];
    this.selected = null;
    this.pending = [];
    this.svg.replaceChildren();
    this.mutate?.();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.place.removeEventListener('mousedown', this.onDown);
    this.surface.removeEventListener('mousedown', this.onSelectDown, true);
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
    this.unsub?.();
    this.ro?.disconnect();
    this.svg.remove();
    this.place.remove();
  }

  private xy = (e: MouseEvent) => {
    const r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  private coord(t: number, p: number): { x: number; y: number } | null {
    const x = this.chart.timeScale().timeToCoordinate(t as UTCTimestamp);
    const y = this.series.priceToCoordinate(p);
    if (x == null || y == null) return null;
    return { x, y };
  }

  private fromXy(x: number, y: number): { t: number; p: number } | null {
    const tRaw = this.chart.timeScale().coordinateToTime(x);
    const p = this.series.coordinateToPrice(y);
    if (tRaw == null || p == null) return null;
    const t = typeof tRaw === 'number' ? tRaw : Number(tRaw);
    if (!Number.isFinite(t) || !Number.isFinite(p)) return null;
    return { t, p };
  }

  /** Select mode: the placement layer is transparent so the chart keeps panning. */
  private onSelectDown = (e: MouseEvent) => {
    if (e.button !== 0 || this.mode !== 'none' || !this.selectEnabled) return;
    const { x, y } = this.xy(e);
    const hit = this.hit(x, y);
    if (!hit) {
      if (this.selected) {
        this.selected = null;
        this.redraw();
      }
      return;
    }
    this.beginDrag(hit, x, y);
    e.preventDefault();
    e.stopPropagation();
  };

  private onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const { x, y } = this.xy(e);
    if (this.mode === 'none') return;
    const pt = this.fromXy(x, y);
    if (!pt) return;
    e.preventDefault();
    const kind = this.mode as ForexExtraKind;
    this.pending.push(pt);
    if (this.pending.length < ANCHORS[kind]) {
      this.redraw();
      return;
    }
    const pts = this.pending.slice(0, ANCHORS[kind]);
    this.pending = [];
    const [a, b, c, d] = pts;
    const item: Item = {
      id: id(),
      kind,
      t1: a!.t,
      p1: a!.p,
      t2: (b ?? a)!.t,
      p2: (b ?? a)!.p,
    };
    const need3 = ['channel', 'fibext', 'fibchan', 'regchannel', 'triangle'] as const;
    if (need3.includes(kind as (typeof need3)[number])) {
      item.t3 = c!.t;
      item.p3 = c!.p;
    }
    if (kind === 'polygon' && d) {
      item.t3 = c!.t;
      item.p3 = c!.p;
      item.t4 = d.t;
      item.p4 = d.p;
    }
    if (kind === 'text') {
      const label = typeof window === 'undefined' ? null : window.prompt('Annotation text');
      const trimmed = (label ?? '').trim().slice(0, 60);
      if (!trimmed) {
        this.redraw();
        return;
      }
      item.label = trimmed;
    }
    if (kind === 'pricelabel') {
      item.label = item.p1.toFixed(5);
    }
    if (kind === 'callout') {
      const label = typeof window === 'undefined' ? null : window.prompt('Callout text');
      const trimmed = (label ?? 'Note').trim().slice(0, 80);
      item.label = trimmed;
    }
    this.pushHistory();
    this.items.push(item);
    this.mutate?.();
    this.redraw();
  };

  private cloneItems(): Item[] {
    return JSON.parse(JSON.stringify(this.items)) as Item[];
  }

  private pushHistory(): void {
    this.undoStack.push(this.cloneItems());
    if (this.undoStack.length > 80) this.undoStack.shift();
    this.redoStack = [];
  }

  undo(): boolean {
    if (this.undoStack.length === 0) return false;
    this.redoStack.push(this.cloneItems());
    this.items = this.undoStack.pop()!;
    this.mutate?.();
    this.redraw();
    return true;
  }

  redo(): boolean {
    if (this.redoStack.length === 0) return false;
    this.undoStack.push(this.cloneItems());
    this.items = this.redoStack.pop()!;
    this.mutate?.();
    this.redraw();
    return true;
  }

  private beginDrag(hit: { id: string; handle: Handle }, x: number, y: number): void {
    const item = this.items.find((i) => i.id === hit.id);
    if (item?.locked) return;
    this.pushHistory();
    this.selected = hit.id;
    this.drag = { id: hit.id, handle: hit.handle, lastX: x, lastY: y };
    window.addEventListener('mousemove', this.onMove);
    window.addEventListener('mouseup', this.onUp);
    this.redraw();
  }

  private onMove = (e: MouseEvent) => {
    if (!this.drag) return;
    const { x, y } = this.xy(e);
    const item = this.items.find((i) => i.id === this.drag!.id);
    if (!item) return;
    if (this.drag.handle !== 0) {
      const pt = this.fromXy(x, y);
      if (!pt) return;
      if (this.drag.handle === 1) {
        item.t1 = pt.t;
        item.p1 = pt.p;
      } else if (this.drag.handle === 2) {
        item.t2 = pt.t;
        item.p2 = pt.p;
      } else {
        item.t3 = pt.t;
        item.p3 = pt.p;
      }
    } else {
      const a = this.fromXy(this.drag.lastX, this.drag.lastY);
      const b = this.fromXy(x, y);
      if (!a || !b) return;
      item.t1 += b.t - a.t;
      item.t2 += b.t - a.t;
      item.p1 += b.p - a.p;
      item.p2 += b.p - a.p;
      if (item.t3 != null) item.t3 += b.t - a.t;
      if (item.p3 != null) item.p3 += b.p - a.p;
      this.drag.lastX = x;
      this.drag.lastY = y;
    }
    this.redraw();
  };

  private onUp = () => {
    if (this.drag) this.mutate?.();
    this.drag = null;
    window.removeEventListener('mousemove', this.onMove);
    window.removeEventListener('mouseup', this.onUp);
  };

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) {
      e.preventDefault();
      this.redo();
      return;
    }
    if (e.key === 'Escape') {
      if (this.pending.length > 0) {
        this.pending = [];
        this.redraw();
        e.preventDefault();
        return;
      }
      if (this.selected) {
        this.selected = null;
        this.redraw();
        e.preventDefault();
      }
      return;
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      const cur = this.items.find((i) => i.id === this.selected);
      if (cur?.locked) return;
      this.pushHistory();
      this.items = this.items.filter((i) => i.id !== this.selected);
      this.selected = null;
      this.mutate?.();
      this.redraw();
      e.preventDefault();
      return;
    }
    if (this.selected && (e.key === 'h' || e.key === 'H')) {
      const cur = this.items.find((i) => i.id === this.selected);
      if (cur) {
        this.pushHistory();
        cur.hidden = !cur.hidden;
        this.mutate?.();
        this.redraw();
      }
      e.preventDefault();
      return;
    }
    if (this.selected && (e.key === 'l' || e.key === 'L')) {
      const cur = this.items.find((i) => i.id === this.selected);
      if (cur) {
        this.pushHistory();
        cur.locked = !cur.locked;
        this.mutate?.();
        this.redraw();
      }
      e.preventDefault();
    }
  };

  private nearSegment(
    x: number,
    y: number,
    a: { x: number; y: number },
    b: { x: number; y: number },
    mode: 'segment' | 'ray' | 'extended'
  ): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    if (mode === 'ray') t = Math.max(0, t);
    else if (mode === 'segment') t = Math.max(0, Math.min(1, t));
    return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)) <= HIT;
  }

  private hit(x: number, y: number): { id: string; handle: Handle } | null {
    for (const it of this.items) {
      if (it.hidden) continue;
      const a = this.coord(it.t1, it.p1);
      const b = this.coord(it.t2, it.p2);
      if (!a) continue;
      if (Math.hypot(x - a.x, y - a.y) <= HANDLE + 2) return { id: it.id, handle: 1 };
      if (it.kind === 'text') {
        const w = textWidth(it.label ?? '');
        if (x >= a.x - 4 && x <= a.x + w && y >= a.y - 16 && y <= a.y + 6) return { id: it.id, handle: 1 };
        continue;
      }
      if (it.kind === 'sr') {
        if (Math.abs(y - a.y) <= HIT) return { id: it.id, handle: 1 };
        continue;
      }
      if (!b) continue;
      if (Math.hypot(x - b.x, y - b.y) <= HANDLE + 2) return { id: it.id, handle: 2 };
      if (it.t3 != null && it.p3 != null) {
        const c = this.coord(it.t3, it.p3);
        if (c && Math.hypot(x - c.x, y - c.y) <= HANDLE + 2) return { id: it.id, handle: 3 };
      }
      if (it.kind === 'rect') {
        const minX = Math.min(a.x, b.x);
        const maxX = Math.max(a.x, b.x);
        const minY = Math.min(a.y, b.y);
        const maxY = Math.max(a.y, b.y);
        const near =
          (Math.abs(x - minX) <= HIT && y >= minY && y <= maxY) ||
          (Math.abs(x - maxX) <= HIT && y >= minY && y <= maxY) ||
          (Math.abs(y - minY) <= HIT && x >= minX && x <= maxX) ||
          (Math.abs(y - maxY) <= HIT && x >= minX && x <= maxX);
        if (near) return { id: it.id, handle: 0 };
      } else if (it.kind === 'channel') {
        if (this.nearSegment(x, y, a, b, 'extended')) return { id: it.id, handle: 0 };
        const off = channelOffset(it);
        const a2 = this.coord(it.t1, it.p1 + off);
        const b2 = this.coord(it.t2, it.p2 + off);
        if (a2 && b2 && this.nearSegment(x, y, a2, b2, 'extended')) return { id: it.id, handle: 0 };
      } else {
        const mode = it.kind === 'ray' ? 'ray' : it.kind === 'extended' ? 'extended' : 'segment';
        if (this.nearSegment(x, y, a, b, mode)) return { id: it.id, handle: 0 };
      }
    }
    return null;
  }

  private line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    width: string,
    dash?: string
  ): SVGLineElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    el.setAttribute('x1', String(x1));
    el.setAttribute('y1', String(y1));
    el.setAttribute('x2', String(x2));
    el.setAttribute('y2', String(y2));
    el.setAttribute('stroke', stroke);
    el.setAttribute('stroke-width', width);
    if (dash) el.setAttribute('stroke-dasharray', dash);
    return el;
  }

  private label(x: number, y: number, text: string, fill = 'rgba(226,232,240,0.9)'): SVGTextElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.setAttribute('fill', fill);
    el.setAttribute('font-size', '10');
    el.textContent = text;
    return el;
  }

  private redraw(): void {
    const w = this.root.clientWidth || 1;
    const h = this.root.clientHeight || 1;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    for (const it of this.items) {
      if (it.hidden) continue;
      const a = this.coord(it.t1, it.p1);
      const b = this.coord(it.t2, it.p2);
      if (!a) continue;
      const sel = it.id === this.selected;
      const lockMark = it.locked ? ' 🔒' : '';
      const color = sel ? 'rgba(245,184,0,0.95)' : 'rgba(148,163,184,0.85)';
      const anchors: Array<{ x: number; y: number }> = [a];
      if (it.kind === 'text') {
        const label = it.label ?? '';
        const bg = document.createElementNS(ns, 'rect');
        bg.setAttribute('x', String(a.x - 4));
        bg.setAttribute('y', String(a.y - 14));
        bg.setAttribute('width', String(textWidth(label)));
        bg.setAttribute('height', '18');
        bg.setAttribute('rx', '3');
        bg.setAttribute('fill', sel ? 'rgba(245,184,0,0.18)' : 'rgba(15,23,42,0.55)');
        bg.setAttribute('stroke', sel ? color : 'rgba(148,163,184,0.35)');
        this.svg.appendChild(bg);
        this.svg.appendChild(this.label(a.x, a.y, label, sel ? color : 'rgba(226,232,240,0.95)'));
      } else if (it.kind === 'sr' || it.kind === 'pricelabel') {
        this.svg.appendChild(
          this.line(0, a.y, w, a.y, sel ? color : 'rgba(56,189,248,0.8)', sel ? '2' : '1.25', '6 3')
        );
        this.svg.appendChild(
          this.label(
            8,
            a.y - 3,
            `${it.label ?? (it.kind === 'pricelabel' ? it.p1.toFixed(5) : 'S/R')}${lockMark}`,
            sel ? color : 'rgba(186,230,253,0.9)'
          )
        );
      } else if (it.kind === 'callout' && b) {
        anchors.push(b);
        this.svg.appendChild(this.line(a.x, a.y, b.x, b.y, color, '1'));
        const label = it.label ?? 'Note';
        const bg = document.createElementNS(ns, 'rect');
        bg.setAttribute('x', String(a.x - 4));
        bg.setAttribute('y', String(a.y - 14));
        bg.setAttribute('width', String(textWidth(label)));
        bg.setAttribute('height', '18');
        bg.setAttribute('rx', '3');
        bg.setAttribute('fill', 'rgba(15,23,42,0.65)');
        bg.setAttribute('stroke', color);
        this.svg.appendChild(bg);
        this.svg.appendChild(this.label(a.x, a.y, `${label}${lockMark}`, color));
      } else if (!b) {
        continue;
      } else if (it.kind === 'rect') {
        anchors.push(b);
        const rect = document.createElementNS(ns, 'rect');
        rect.setAttribute('x', String(Math.min(a.x, b.x)));
        rect.setAttribute('y', String(Math.min(a.y, b.y)));
        rect.setAttribute('width', String(Math.abs(b.x - a.x)));
        rect.setAttribute('height', String(Math.abs(b.y - a.y)));
        rect.setAttribute('fill', sel ? 'rgba(245,184,0,0.12)' : 'rgba(148,163,184,0.08)');
        rect.setAttribute('stroke', color);
        rect.setAttribute('stroke-width', sel ? '2' : '1');
        this.svg.appendChild(rect);
      } else if (it.kind === 'fib2') {
        anchors.push(b);
        const range = it.p2 - it.p1;
        for (const r of FIB_RATIOS) {
          const price = it.p1 + r * range;
          const y = this.series.priceToCoordinate(price);
          if (y == null) continue;
          this.svg.appendChild(
            this.line(
              0,
              y,
              w,
              y,
              sel ? 'rgba(245,184,0,0.75)' : 'rgba(167,139,250,0.65)',
              '1',
              r === 0 || r === 1 ? undefined : '4 3'
            )
          );
          this.svg.appendChild(
            this.label(8, y - 3, `${(r * 100).toFixed(r === 0 || r === 1 || r === 0.5 ? 0 : 1)}%  ${price.toFixed(5)}`)
          );
        }
      } else if (it.kind === 'fibext') {
        anchors.push(b);
        const c = this.coord(it.t3 ?? it.t2, it.p3 ?? it.p2);
        if (c) anchors.push(c);
        const swing = it.p2 - it.p1;
        const from = it.p3 ?? it.p2;
        const guide = sel ? 'rgba(245,184,0,0.55)' : 'rgba(148,163,184,0.5)';
        this.svg.appendChild(this.line(a.x, a.y, b.x, b.y, guide, '1', '3 3'));
        if (c) this.svg.appendChild(this.line(b.x, b.y, c.x, c.y, guide, '1', '3 3'));
        for (const r of FIB_EXT_RATIOS) {
          const price = from + r * swing;
          const y = this.series.priceToCoordinate(price);
          if (y == null) continue;
          const x0 = c ? Math.max(0, Math.min(c.x, w)) : 0;
          this.svg.appendChild(
            this.line(
              x0,
              y,
              w,
              y,
              sel ? 'rgba(245,184,0,0.8)' : 'rgba(45,212,191,0.7)',
              r === 1 || r === 1.618 ? '1.5' : '1',
              r === 0 || r === 1 ? undefined : '4 3'
            )
          );
          this.svg.appendChild(
            this.label(x0 + 8, y - 3, `${(r * 100).toFixed(r % 1 === 0 ? 0 : 1)}%  ${price.toFixed(5)}`)
          );
        }
      } else if (it.kind === 'fibexp') {
        anchors.push(b);
        const range = it.p2 - it.p1;
        for (const r of FIB_EXPANSION_RATIOS) {
          const price = it.p1 + r * range;
          const y = this.series.priceToCoordinate(price);
          if (y == null) continue;
          this.svg.appendChild(
            this.line(0, y, w, y, sel ? 'rgba(245,184,0,0.75)' : 'rgba(52,211,153,0.65)', '1', r === 0 ? undefined : '4 3')
          );
          this.svg.appendChild(this.label(8, y - 3, `Exp ${(r * 100).toFixed(1)}%  ${price.toFixed(5)}`));
        }
      } else if (it.kind === 'fibtime') {
        anchors.push(b);
        const t0 = Math.min(it.t1, it.t2);
        const tSpan = Math.abs(it.t2 - it.t1);
        for (const r of FIB_TIME_RATIOS) {
          const t = t0 + r * tSpan;
          const x = this.chart.timeScale().timeToCoordinate(t as UTCTimestamp);
          if (x == null) continue;
          this.svg.appendChild(
            this.line(x, 0, x, h, sel ? 'rgba(245,184,0,0.65)' : 'rgba(167,139,250,0.55)', '1', r === 0 || r === 1 ? undefined : '3 3')
          );
          this.svg.appendChild(this.label(x + 4, 12, `${(r * 100).toFixed(1)}%`));
        }
      } else if (it.kind === 'fibchan') {
        anchors.push(b);
        const off = channelOffset(it);
        const lo = Math.min(it.p1, it.p2);
        const hi = Math.max(it.p1, it.p2);
        for (const r of FIB_RATIOS) {
          const price = lo + r * (hi - lo);
          const y = this.series.priceToCoordinate(price);
          if (y == null) continue;
          this.svg.appendChild(this.line(0, y, w, y, 'rgba(167,139,250,0.45)', '1', '4 3'));
        }
        const a2 = this.coord(it.t1, it.p1 + off);
        const b2 = this.coord(it.t2, it.p2 + off);
        if (a2 && b2) {
          const clipped = clipLine(a.x, a.y, b.x, b.y, w, h, 'extended') ?? [a.x, a.y, b.x, b.y];
          const par = clipLine(a2.x, a2.y, b2.x, b2.y, w, h, 'extended') ?? [a2.x, a2.y, b2.x, b2.y];
          this.svg.appendChild(this.line(clipped[0], clipped[1], clipped[2], clipped[3], color, '1.5'));
          this.svg.appendChild(this.line(par[0], par[1], par[2], par[3], color, '1.5'));
        }
      } else if (it.kind === 'regchannel') {
        anchors.push(b);
        const off = channelOffset(it);
        const mid = (it.p1 + it.p2) / 2;
        const midY = this.series.priceToCoordinate(mid);
        if (midY != null) {
          this.svg.appendChild(this.line(0, midY, w, midY, 'rgba(251,191,36,0.55)', '1', '6 4'));
        }
        const a2 = this.coord(it.t1, it.p1 + off);
        const b2 = this.coord(it.t2, it.p2 + off);
        const base = clipLine(a.x, a.y, b.x, b.y, w, h, 'extended') ?? [a.x, a.y, b.x, b.y];
        this.svg.appendChild(this.line(base[0], base[1], base[2], base[3], color, sel ? '2' : '1.25'));
        if (a2 && b2) {
          const par = clipLine(a2.x, a2.y, b2.x, b2.y, w, h, 'extended') ?? [a2.x, a2.y, b2.x, b2.y];
          this.svg.appendChild(this.line(par[0], par[1], par[2], par[3], color, sel ? '2' : '1.25'));
        }
        const c = this.coord(it.t3 ?? it.t2, it.p3 ?? it.p2);
        if (c) anchors.push(c);
      } else if (it.kind === 'gannline' || it.kind === 'gannfan' || it.kind === 'ganngrid') {
        anchors.push(b);
        const multipliers = it.kind === 'gannline' ? [1] : it.kind === 'gannfan' ? [0.5, 1, 2, 4] : [0.5, 1, 1.5, 2, 3, 4];
        for (const mul of multipliers) {
          const dx = b.x - a.x;
          const dy = (b.y - a.y) * mul;
          const ray = clipLine(a.x, a.y, a.x + dx * 6, a.y + dy * 6, w, h, 'ray');
          if (!ray) continue;
          this.svg.appendChild(this.line(ray[0], ray[1], ray[2], ray[3], color, '1', mul === 1 ? undefined : '3 3'));
        }
        if (it.kind === 'ganngrid') {
          for (const mul of [0.75, 1.25]) {
            const dx = (b.x - a.x) * mul;
            const dy = b.y - a.y;
            const ray = clipLine(a.x, a.y, a.x + dx * 4, a.y + dy * 4, w, h, 'extended');
            if (ray) this.svg.appendChild(this.line(ray[0], ray[1], ray[2], ray[3], 'rgba(148,163,184,0.35)', '1', '2 4'));
          }
        }
      } else if (it.kind === 'ellipse') {
        anchors.push(b);
        const ell = document.createElementNS(ns, 'ellipse');
        ell.setAttribute('cx', String((a.x + b.x) / 2));
        ell.setAttribute('cy', String((a.y + b.y) / 2));
        ell.setAttribute('rx', String(Math.abs(b.x - a.x) / 2));
        ell.setAttribute('ry', String(Math.abs(b.y - a.y) / 2));
        ell.setAttribute('fill', sel ? 'rgba(245,184,0,0.1)' : 'rgba(148,163,184,0.08)');
        ell.setAttribute('stroke', color);
        this.svg.appendChild(ell);
      } else if (it.kind === 'triangle') {
        anchors.push(b);
        const c = this.coord(it.t3 ?? it.t2, it.p3 ?? it.p2);
        if (c) {
          anchors.push(c);
          const poly = document.createElementNS(ns, 'polygon');
          poly.setAttribute('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`);
          poly.setAttribute('fill', sel ? 'rgba(245,184,0,0.12)' : 'rgba(148,163,184,0.08)');
          poly.setAttribute('stroke', color);
          this.svg.appendChild(poly);
        }
      } else if (it.kind === 'polygon' && it.t4 != null && it.p4 != null) {
        anchors.push(b);
        const c = this.coord(it.t3!, it.p3!);
        const d = this.coord(it.t4, it.p4);
        if (c && d) {
          anchors.push(c, d);
          const poly = document.createElementNS(ns, 'polygon');
          poly.setAttribute('points', `${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y} ${d.x},${d.y}`);
          poly.setAttribute('fill', sel ? 'rgba(245,184,0,0.1)' : 'rgba(148,163,184,0.07)');
          poly.setAttribute('stroke', color);
          this.svg.appendChild(poly);
        }
      } else if (it.kind === 'channel') {
        anchors.push(b);
        const off = channelOffset(it);
        const a2 = this.coord(it.t1, it.p1 + off);
        const b2 = this.coord(it.t2, it.p2 + off);
        const c = this.coord(it.t3 ?? it.t2, it.p3 ?? it.p2);
        if (c) anchors.push(c);
        const base = clipLine(a.x, a.y, b.x, b.y, w, h, 'extended') ?? [a.x, a.y, b.x, b.y];
        const par =
          a2 && b2 ? clipLine(a2.x, a2.y, b2.x, b2.y, w, h, 'extended') ?? [a2.x, a2.y, b2.x, b2.y] : null;
        if (par) {
          const band = document.createElementNS(ns, 'polygon');
          band.setAttribute(
            'points',
            `${base[0]},${base[1]} ${base[2]},${base[3]} ${par[2]},${par[3]} ${par[0]},${par[1]}`
          );
          band.setAttribute('fill', sel ? 'rgba(245,184,0,0.1)' : 'rgba(148,163,184,0.07)');
          this.svg.appendChild(band);
          this.svg.appendChild(this.line(par[0], par[1], par[2], par[3], color, sel ? '2' : '1.25'));
        }
        this.svg.appendChild(this.line(base[0], base[1], base[2], base[3], color, sel ? '2' : '1.25'));
      } else if (it.kind === 'ray' || it.kind === 'extended' || it.kind === 'arrow') {
        anchors.push(b);
        const mode = it.kind === 'ray' ? 'ray' : it.kind === 'extended' ? 'extended' : 'segment';
        const clipped = clipLine(a.x, a.y, b.x, b.y, w, h, mode) ?? [a.x, a.y, b.x, b.y];
        this.svg.appendChild(this.line(clipped[0], clipped[1], clipped[2], clipped[3], color, sel ? '2' : '1.25'));
        if (it.kind === 'arrow') {
          const ang = Math.atan2(b.y - a.y, b.x - a.x);
          const path = document.createElementNS(ns, 'path');
          const s = 8;
          path.setAttribute(
            'd',
            `M ${b.x} ${b.y} L ${b.x - s * Math.cos(ang - 0.45)} ${b.y - s * Math.sin(ang - 0.45)} L ${b.x - s * Math.cos(ang + 0.45)} ${b.y - s * Math.sin(ang + 0.45)} Z`
          );
          path.setAttribute('fill', color);
          this.svg.appendChild(path);
        }
      }
      for (const pt of anchors) {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', String(pt.x));
        c.setAttribute('cy', String(pt.y));
        c.setAttribute('r', String(HANDLE - 1));
        c.setAttribute('fill', sel ? 'rgba(245,184,0,0.95)' : 'rgba(148,163,184,0.7)');
        this.svg.appendChild(c);
      }
    }
    for (const pt of this.pending) {
      const c = this.coord(pt.t, pt.p);
      if (!c) continue;
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('cx', String(c.x));
      dot.setAttribute('cy', String(c.y));
      dot.setAttribute('r', String(HANDLE - 2));
      dot.setAttribute('fill', 'rgba(245,184,0,0.6)');
      this.svg.appendChild(dot);
    }
  }
}
