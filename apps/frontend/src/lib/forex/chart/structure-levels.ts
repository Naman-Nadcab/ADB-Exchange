/**
 * Important levels derived from valid OHLC only. No hard-coded prices.
 */
import type { ForexCandle } from '../models/candles';
import { candleTimeMs } from '../models/candles';

export type StructureLevelId = 'DO' | 'WO' | 'MO' | 'PDH' | 'PDL' | 'PWH' | 'PWL';

export type StructureLevel = {
  id: StructureLevelId;
  label: string;
  price: number;
};

type Bar = { t: number; open: number; high: number; low: number; close: number };

function toBars(candles: ForexCandle[]): Bar[] {
  const out: Bar[] = [];
  for (const c of candles) {
    const ms = candleTimeMs(c.timestamp);
    if (ms == null) continue;
    const open = Number(c.open);
    const high = Number(c.high);
    const low = Number(c.low);
    const close = Number(c.close);
    if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) continue;
    out.push({ t: ms, open, high, low, close });
  }
  return out.sort((a, b) => a.t - b.t);
}

function utcDayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
}

function utcWeekKey(ms: number): string {
  const d = new Date(ms);
  const day = d.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const mon = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - mondayOffset));
  return `${mon.getUTCFullYear()}-${mon.getUTCMonth()}-${mon.getUTCDate()}`;
}

function utcMonthKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
}

/** Derive levels from the candle series currently loaded (any TF). Best with 1h/1D history. */
export function deriveStructureLevels(candles: ForexCandle[]): StructureLevel[] {
  const bars = toBars(candles);
  if (bars.length < 2) return [];
  const last = bars[bars.length - 1];
  const levels: StructureLevel[] = [];

  const byDay = new Map<string, Bar[]>();
  const byWeek = new Map<string, Bar[]>();
  const byMonth = new Map<string, Bar[]>();
  for (const b of bars) {
    const dk = utcDayKey(b.t);
    const wk = utcWeekKey(b.t);
    const mk = utcMonthKey(b.t);
    (byDay.get(dk) ?? byDay.set(dk, []).get(dk)!).push(b);
    (byWeek.get(wk) ?? byWeek.set(wk, []).get(wk)!).push(b);
    (byMonth.get(mk) ?? byMonth.set(mk, []).get(mk)!).push(b);
  }

  const dayKeys = Array.from(byDay.keys()).sort();
  const weekKeys = Array.from(byWeek.keys()).sort();
  const monthKeys = Array.from(byMonth.keys()).sort();

  const today = byDay.get(utcDayKey(last.t));
  if (today?.length) {
    levels.push({ id: 'DO', label: 'DO', price: today[0].open });
  }
  if (dayKeys.length >= 2) {
    const prev = byDay.get(dayKeys[dayKeys.length - 2])!;
    levels.push({ id: 'PDH', label: 'PDH', price: Math.max(...prev.map((b) => b.high)) });
    levels.push({ id: 'PDL', label: 'PDL', price: Math.min(...prev.map((b) => b.low)) });
  }

  const thisWeek = byWeek.get(utcWeekKey(last.t));
  if (thisWeek?.length) {
    levels.push({ id: 'WO', label: 'WO', price: thisWeek[0].open });
  }
  if (weekKeys.length >= 2) {
    const prevW = byWeek.get(weekKeys[weekKeys.length - 2])!;
    levels.push({ id: 'PWH', label: 'PWH', price: Math.max(...prevW.map((b) => b.high)) });
    levels.push({ id: 'PWL', label: 'PWL', price: Math.min(...prevW.map((b) => b.low)) });
  }

  const thisMonth = byMonth.get(utcMonthKey(last.t));
  if (thisMonth?.length) {
    levels.push({ id: 'MO', label: 'MO', price: thisMonth[0].open });
  }

  // Deduplicate near-identical prices
  const seen = new Set<string>();
  return levels.filter((lv) => {
    const key = `${lv.id}:${lv.price.toFixed(8)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
