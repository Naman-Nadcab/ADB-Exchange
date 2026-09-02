/**
 * Persist-safe timestamptz. node-pg returns Date objects; Date.toString() is rejected by PostgreSQL.
 */
export function forexIsoTimestamp(v: unknown, fallback?: string): string | undefined {
  if (v == null || v === '') return fallback;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? fallback : v.toISOString();
  }
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

export function forexStr(v: unknown): string {
  if (v == null) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString();
  return String(v);
}
