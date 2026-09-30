/**
 * Refuse cert runs unless connected to exchange_forex_cert (never live exchange).
 */
const url = (process.env.FOREX_CERT_DATABASE_URL ?? process.env.DATABASE_URL ?? '').trim();
if (!url.includes('exchange_forex_cert')) {
  console.error(JSON.stringify({ ok: false, error: 'DATABASE_URL must target exchange_forex_cert', urlRedacted: url.replace(/:[^:@]+@/, ':***@') }));
  process.exit(1);
}
if (/[/]exchange(\?|$)/.test(url) && !url.includes('exchange_forex_cert')) {
  console.error(JSON.stringify({ ok: false, error: 'Refusing live exchange database' }));
  process.exit(1);
}

process.env.DATABASE_URL = url;
const { db } = await import('../src/lib/database.js');
const dbName = (await db.query('SELECT current_database() AS n')).rows[0]?.n;
await db.close();
if (String(dbName) !== 'exchange_forex_cert') {
  console.error(JSON.stringify({ ok: false, error: 'current_database mismatch', dbName }));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, current_database: dbName, urlHost: url.split('@').pop()?.split('/')[0] ?? 'unknown' }));
