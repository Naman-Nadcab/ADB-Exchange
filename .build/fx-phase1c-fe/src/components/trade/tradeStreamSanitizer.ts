export type TradeStreamMessage = {
  id: string;
  market: string;
  side: string;
  price: string;
  quantity: string;
  time: string;
};

export function sanitizeIncomingTradesForSymbol(incoming: TradeStreamMessage[], symbol: string): TradeStreamMessage[] {
  const out: TradeStreamMessage[] = [];
  const seen = new Set<string>();
  for (const row of incoming) {
    if (!row || row.market !== symbol) continue;
    const id = (row.id ?? '').trim();
    if (!id || seen.has(id)) continue;
    const price = Number(row.price);
    const qty = Number(row.quantity);
    const tsMs = Date.parse(row.time);
    if (!Number.isFinite(price) || price <= 0) continue;
    if (!Number.isFinite(qty) || qty <= 0) continue;
    if (!Number.isFinite(tsMs) || tsMs <= 0) continue;
    const side = row.side === 'sell' ? 'sell' : row.side === 'buy' ? 'buy' : '';
    if (!side) continue;
    seen.add(id);
    out.push({
      id,
      market: symbol,
      side,
      price: row.price,
      quantity: row.quantity,
      time: row.time,
    });
  }
  return out;
}
