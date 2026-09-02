/**
 * Forex-only drawing layer. Does not modify Crypto DrawingToolManager.
 * Supports ray, extended line, rectangle, arrow, and two-anchor Fibonacci.
 */

import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export type ForexExtraTool = 'none' | 'ray' | 'extended' | 'rect' | 'arrow' | 'fib2';

export type ForexSerializedExtra =
  | { kind: 'ray' | 'extended' | 'rect' | 'arrow' | 'fib2'; t1: number; p1: number; t2: number; p2: number };

const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
const HIT = 8;
const HANDLE = 6;

function id(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `fxd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  kind: ForexSerializedExtra['kind'];
  t1: number;
  p1: number;
  t2: number;
  p2: number;
};

export class ForexDrawingEngine {
  private chart: IChartApi;
  private series: ISeriesApi<'Candlestick'> | ISeriesApi<'Line'> | ISeriesApi<'Area'> | ISeriesApi<'Bar'>;
  private root: HTMLElement;
  private svg: SVGSVGElement;
  private place: HTMLDivElement;
  private mode: ForexExtraTool = 'none';
  private items: Item[] = [];
  private pending: { t: number; p: number } | null = null;
  private selected: string | null = null;
  private drag: { id: string; handle: 0 | 1 | 2; lastX: number; lastY: number } | null = null;
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
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;z-index:3;';
    this.place = document.createElement('div');
    this.place.style.cssText = 'position:absolute;inset:0;z-index:4;pointer-events:none;';
    this.root.appendChild(this.svg);
    this.root.appendChild(this.place);
    this.place.addEventListener('mousedown', this.onDown);
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
    this.pending = null;
    this.place.style.pointerEvents = mode === 'none' ? 'none' : 'auto';
    this.place.style.cursor = mode === 'none' ? 'default' : 'crosshair';
  }

  serialize(): ForexSerializedExtra[] {
    return this.items.map(({ kind, t1, p1, t2, p2 }) => ({ kind, t1, p1, t2, p2 }));
  }

  load(payload: ForexSerializedExtra[]): void {
    this.items = payload
      .filter((d) => Number.isFinite(d.t1) && Number.isFinite(d.p1) && Number.isFinite(d.t2) && Number.isFinite(d.p2))
      .map((d) => ({ id: id(), ...d }));
    this.redraw();
  }

  clearAll(): void {
    this.items = [];
    this.selected = null;
    this.pending = null;
    this.svg.replaceChildren();
    this.mutate?.();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.onKey, true);
    this.place.removeEventListener('mousedown', this.onDown);
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

  private onDown = (e: MouseEvent) => {
    if (e.button !== 0) return;
    const { x, y } = this.xy(e);
    const hit = this.hit(x, y);
    if (hit && this.mode === 'none') {
      this.selected = hit.id;
      this.drag = { id: hit.id, handle: hit.handle, lastX: x, lastY: y };
      window.addEventListener('mousemove', this.onMove);
      window.addEventListener('mouseup', this.onUp);
      this.redraw();
      e.preventDefault();
      return;
    }
    if (this.mode === 'none') return;
    const pt = this.fromXy(x, y);
    if (!pt) return;
    if (!this.pending) {
      this.pending = pt;
      e.preventDefault();
      return;
    }
    const kind =
      this.mode === 'fib2'
        ? 'fib2'
        : this.mode === 'ray'
          ? 'ray'
          : this.mode === 'extended'
            ? 'extended'
            : this.mode === 'rect'
              ? 'rect'
              : 'arrow';
    this.items.push({ id: id(), kind, t1: this.pending.t, p1: this.pending.p, t2: pt.t, p2: pt.p });
    this.pending = null;
    this.mutate?.();
    this.redraw();
    e.preventDefault();
  };

  private onMove = (e: MouseEvent) => {
    if (!this.drag) return;
    const { x, y } = this.xy(e);
    const item = this.items.find((i) => i.id === this.drag!.id);
    if (!item) return;
    if (this.drag.handle === 1 || this.drag.handle === 2) {
      const pt = this.fromXy(x, y);
      if (!pt) return;
      if (this.drag.handle === 1) {
        item.t1 = pt.t;
        item.p1 = pt.p;
      } else {
        item.t2 = pt.t;
        item.p2 = pt.p;
      }
    } else {
      const a = this.fromXy(this.drag.lastX, this.drag.lastY);
      const b = this.fromXy(x, y);
      if (!a || !b) return;
      item.t1 += b.t - a.t;
      item.t2 += b.t - a.t;
      item.p1 += b.p - a.p;
      item.p2 += b.p - a.p;
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
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.selected) {
      this.items = this.items.filter((i) => i.id !== this.selected);
      this.selected = null;
      this.mutate?.();
      this.redraw();
      e.preventDefault();
    }
  };

  private hit(x: number, y: number): { id: string; handle: 0 | 1 | 2 } | null {
    for (const it of this.items) {
      const a = this.coord(it.t1, it.p1);
      const b = this.coord(it.t2, it.p2);
      if (!a || !b) continue;
      if (Math.hypot(x - a.x, y - a.y) <= HANDLE + 2) return { id: it.id, handle: 1 };
      if (Math.hypot(x - b.x, y - b.y) <= HANDLE + 2) return { id: it.id, handle: 2 };
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
      } else {
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const len2 = dx * dx + dy * dy || 1;
        let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
        if (it.kind === 'ray') t = Math.max(0, t);
        else if (it.kind !== 'extended') t = Math.max(0, Math.min(1, t));
        const qx = a.x + t * dx;
        const qy = a.y + t * dy;
        if (Math.hypot(x - qx, y - qy) <= HIT) return { id: it.id, handle: 0 };
      }
    }
    return null;
  }

  private redraw(): void {
    const w = this.root.clientWidth || 1;
    const h = this.root.clientHeight || 1;
    this.svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    this.svg.replaceChildren();
    const ns = 'http://www.w3.org/2000/svg';
    for (const it of this.items) {
      const a = this.coord(it.t1, it.p1);
      const b = this.coord(it.t2, it.p2);
      if (!a || !b) continue;
      const sel = it.id === this.selected;
      const color = sel ? 'rgba(245,184,0,0.95)' : 'rgba(148,163,184,0.85)';
      if (it.kind === 'rect') {
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
        const range = it.p2 - it.p1;
        for (const r of FIB_RATIOS) {
          const price = it.p1 + r * range;
          const y = this.series.priceToCoordinate(price);
          if (y == null) continue;
          const line = document.createElementNS(ns, 'line');
          line.setAttribute('x1', '0');
          line.setAttribute('x2', String(w));
          line.setAttribute('y1', String(y));
          line.setAttribute('y2', String(y));
          line.setAttribute('stroke', sel ? 'rgba(245,184,0,0.75)' : 'rgba(167,139,250,0.65)');
          line.setAttribute('stroke-width', '1');
          line.setAttribute('stroke-dasharray', r === 0 || r === 1 ? '0' : '4 3');
          this.svg.appendChild(line);
          const lab = document.createElementNS(ns, 'text');
          lab.setAttribute('x', '8');
          lab.setAttribute('y', String(y - 3));
          lab.setAttribute('fill', 'rgba(226,232,240,0.9)');
          lab.setAttribute('font-size', '10');
          lab.textContent = `${(r * 100).toFixed(r === 0 || r === 1 || r === 0.5 ? 0 : 1)}%  ${price.toFixed(5)}`;
          this.svg.appendChild(lab);
        }
      } else {
        const mode = it.kind === 'ray' ? 'ray' : it.kind === 'extended' ? 'extended' : 'segment';
        const clipped = clipLine(a.x, a.y, b.x, b.y, w, h, mode) ?? [a.x, a.y, b.x, b.y];
        const line = document.createElementNS(ns, 'line');
        line.setAttribute('x1', String(clipped[0]));
        line.setAttribute('y1', String(clipped[1]));
        line.setAttribute('x2', String(clipped[2]));
        line.setAttribute('y2', String(clipped[3]));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', sel ? '2' : '1.25');
        this.svg.appendChild(line);
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
      for (const pt of [a, b]) {
        const c = document.createElementNS(ns, 'circle');
        c.setAttribute('cx', String(pt.x));
        c.setAttribute('cy', String(pt.y));
        c.setAttribute('r', String(HANDLE - 1));
        c.setAttribute('fill', sel ? 'rgba(245,184,0,0.95)' : 'rgba(148,163,184,0.7)');
        this.svg.appendChild(c);
      }
    }
  }
}
