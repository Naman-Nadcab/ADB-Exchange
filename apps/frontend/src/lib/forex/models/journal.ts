/**
 * Client-observed journal from authoritative store snapshots.
 * Not a secret-bearing server log. No fabricated events.
 */
import { formatForexPair } from './pair-label';
import type { ForexFillRow, ForexPublicOrder, ForexPublicPosition, ForexPublicProtection } from './types';

export type JournalSeverity = 'info' | 'warn' | 'error';

export interface JournalEntry {
  id: string;
  timestamp: string;
  severity: JournalSeverity;
  category: string;
  message: string;
  referenceId?: string;
}

function lots(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : raw;
}

function sideWord(raw: string): string {
  const value = raw.toLowerCase();
  if (value === 'buy' || value === 'long') return 'Buy';
  if (value === 'sell' || value === 'short') return 'Sell';
  return raw;
}

function verbWord(raw: string): string {
  return raw.toLowerCase().replace(/_/g, ' ');
}

/**
 * Customer journal line. Drops category and event-type prefixes.
 * Unrecognised text is returned unchanged.
 */
export function customerJournalLine(message: string): string {
  const text = message.trim();
  if (/^(Buy|Sell|Stop loss|Take profit)\b/.test(text)) return text;

  const order = text.match(
    /^(buy|sell)\s+(stop_limit|market|limit|stop)\s+([A-Za-z0-9./]+)\s+([0-9]+(?:\.[0-9]+)?)\s+(accepted|working|modified|filled|cancelled|rejected|failed)(?:\s+·\s+([\s\S]+))?$/i
  );
  if (order) {
    const kind = order[2]!.toLowerCase().replace('_', ' ');
    const head = kind === 'market' ? sideWord(order[1]!) : `${sideWord(order[1]!)} ${kind}`;
    const extra = order[6] ? ` · ${order[6]}` : '';
    return `${head} ${lots(order[4]!)} ${formatForexPair(order[3]!)} ${verbWord(order[5]!)}${extra}`;
  }

  const protection = text.match(
    /^(STOP_LOSS|TAKE_PROFIT)\s+([A-Za-z0-9./]+)\s+([0-9]+(?:\.[0-9]+)?)\s+@\s+([0-9]+(?:\.[0-9]+)?)\s+(created|updated|cancelled|triggered|filled|failed)([\s\S]*)$/i
  );
  if (protection) {
    const kind = protection[1]!.toUpperCase() === 'STOP_LOSS' ? 'Stop loss' : 'Take profit';
    const rest = protection[6] ?? '';
    return `${kind} ${formatForexPair(protection[2]!)} ${lots(protection[3]!)} at ${protection[4]} ${verbWord(protection[5]!)}${rest}`;
  }

  const fill = text.match(/^Fill\s+(buy|sell)\s+([A-Za-z0-9./]+)\s+([0-9.]+)\s+@\s+([0-9.]+)\s*$/i);
  if (fill) return `${sideWord(fill[1]!)} ${lots(fill[3]!)} ${formatForexPair(fill[2]!)} filled at ${fill[4]}`;

  const closed = text.match(/^Position closed\s+([A-Za-z0-9./]+)\s+(long|short|buy|sell)\s+([0-9.]+)\s*$/i);
  if (closed) return `${sideWord(closed[2]!)} ${lots(closed[3]!)} ${formatForexPair(closed[1]!)} closed`;

  const clientOrder = text.match(
    /^(BUY|SELL)\s+(STOP_LIMIT|MARKET|LIMIT|STOP)\s+([A-Za-z0-9./]+)\s+([0-9.]+)\s+→\s+([A-Za-z_]+)(?:\s+·\s+([\s\S]+))?$/
  );
  if (clientOrder) {
    const kind = clientOrder[2]!.toLowerCase().replace('_', ' ');
    const head = kind === 'market' ? sideWord(clientOrder[1]!) : `${sideWord(clientOrder[1]!)} ${kind}`;
    const extra = clientOrder[6] ? ` · ${clientOrder[6]}` : '';
    return `${head} ${lots(clientOrder[4]!)} ${formatForexPair(clientOrder[3]!)} ${verbWord(clientOrder[5]!)}${extra}`;
  }

  const clientProtection = text.match(/^(STOP_LOSS|TAKE_PROFIT)\s+([A-Za-z0-9./]+)\s+@\s+([0-9.]+)\s+→\s+([A-Za-z_]+)([\s\S]*)$/);
  if (clientProtection) {
    const kind = clientProtection[1] === 'STOP_LOSS' ? 'Stop loss' : 'Take profit';
    return `${kind} ${formatForexPair(clientProtection[2]!)} at ${clientProtection[3]} ${verbWord(clientProtection[4]!)}${clientProtection[5] ?? ''}`;
  }

  return text;
}

export function buildForexJournal(args: {
  orders: ForexPublicOrder[];
  fills: ForexFillRow[];
  positions: ForexPublicPosition[];
  protections: ForexPublicProtection[];
  hydratePhase: string;
  socketState: string;
}): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const o of args.orders) {
    const st = String(o.status).toUpperCase();
    const sev: JournalSeverity = st === 'REJECTED' || st === 'FAILED' ? 'error' : st === 'CANCELLED' ? 'warn' : 'info';
    out.push({
      id: `ord-${o.orderId}-${o.updatedAt}`,
      timestamp: o.updatedAt || o.createdAt,
      severity: sev,
      category: 'order',
      message: `${o.side.toUpperCase()} ${o.type} ${o.symbol} ${o.requestedVolume} → ${o.status}${
        o.failureReason ? ` · ${o.failureReason}` : ''
      }`,
      referenceId: o.orderId,
    });
  }
  for (const f of args.fills) {
    out.push({
      id: `fill-${f.fillId}`,
      timestamp: f.timestamp,
      severity: 'info',
      category: 'fill',
      message: `Fill ${f.side} ${f.symbol} ${f.volume} @ ${f.price}`,
      referenceId: f.fillId,
    });
  }
  for (const p of args.positions) {
    if (p.status === 'CLOSED') {
      out.push({
        id: `pos-${p.positionId}-closed`,
        timestamp: p.closedAt ?? p.updatedAt,
        severity: 'info',
        category: 'position',
        message: `Position closed ${p.symbol} ${p.side} ${p.volume}`,
        referenceId: p.positionId,
      });
    }
  }
  for (const pr of args.protections) {
    out.push({
      id: `prot-${pr.protectionId}-${pr.status}`,
      timestamp: new Date().toISOString(),
      severity: pr.status === 'FAILED' ? 'error' : pr.status === 'TRIGGERED' || pr.status === 'FILLED' ? 'warn' : 'info',
      category: pr.type === 'STOP_LOSS' ? 'sl' : 'tp',
      message: `${pr.type} ${pr.symbol} @ ${pr.triggerPrice} → ${pr.status}${
        pr.trailingDistance ? ` · trail ${pr.trailingDistance}` : ''
      }${pr.failureReason ? ` · ${pr.failureReason}` : ''}`,
      referenceId: pr.protectionId,
    });
  }
  out.push({
    id: 'session',
    timestamp: new Date().toISOString(),
    severity: args.hydratePhase === 'error' ? 'error' : 'info',
    category: 'system',
    message: `Hydrate ${args.hydratePhase} · socket ${args.socketState}`,
  });
  return out.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 200);
}
