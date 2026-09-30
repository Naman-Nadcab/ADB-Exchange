/**
 * Browser-safe Forex client identifiers.
 * Never call Node `crypto.randomUUID` from client bundles.
 * Works over HTTP (non-secure contexts) where `crypto.randomUUID` is missing.
 */

let seq = 0;

function bytesToUuid(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function generateForexUuid(): string {
  const c = typeof globalThis !== 'undefined' ? (globalThis as { crypto?: Crypto }).crypto : undefined;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID();
  }
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    return bytesToUuid(bytes);
  }
  seq += 1;
  const t = Date.now().toString(16).padStart(12, '0');
  const n = seq.toString(16).padStart(8, '0');
  return `00000000-0000-4000-8000-${t.slice(-8)}${n.slice(-4)}`.slice(0, 36);
}

/** Idempotent clientOrderId for POST /api/v1/forex/orders. */
export function generateClientOrderId(prefix = 'fx'): string {
  const safe = prefix.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 12) || 'fx';
  return `${safe}-${generateForexUuid()}`;
}
