/**
 * Deterministic HTTP stub for the existing generic sanctions provider contract.
 * This is not a live screening vendor. It never logs API keys.
 *
 * POST /screen
 *   Header X-API-Key
 *   JSON { address, name, amount, asset, userId }
 *   200 { allowed, riskScore, reason } | 401 | 500 | non-JSON
 *
 * Address suffix (mode by-address):
 *   0a7c match, 0500 HTTP 500, 0701 sleep 12s, 0bad non-JSON, 0e00 {}
 *   anything else CLEAR
 *
 * POST /__control { "mode": "by-address"|"unauthorized"|"timeout"|"error"|"malformed"|"empty" }
 * POST /__reset
 * GET  /__stats
 */
import http from 'node:http';

const key = process.env.STUB_API_KEY || '';
const port = Number(process.env.PORT || 8090);
let mode = 'by-address';
let count = 0;
let lastKind = 'none';

function send(res, status, body, contentType = 'application/json') {
  const payload = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, { 'content-type': contentType, 'content-length': Buffer.byteLength(payload) });
  res.end(payload);
}

function kindFor(address) {
  const a = String(address || '').toLowerCase();
  if (a.endsWith('0a7c')) return 'match';
  if (a.endsWith('0500')) return 'http-500';
  if (a.endsWith('0701')) return 'timeout';
  if (a.endsWith('0bad')) return 'malformed';
  if (a.endsWith('0e00')) return 'empty';
  return 'clear';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://stub');
    if (req.method === 'GET' && url.pathname === '/__stats') {
      send(res, 200, { count, lastKind, mode });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/__reset') {
      await readBody(req);
      count = 0;
      lastKind = 'none';
      mode = 'by-address';
      send(res, 200, { ok: true });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/__control') {
      const raw = await readBody(req);
      const body = JSON.parse(raw.toString() || '{}');
      mode = String(body.mode || 'by-address');
      send(res, 200, { ok: true, mode });
      return;
    }
    if (req.method !== 'POST' || url.pathname !== '/screen') {
      send(res, 404, { error: 'not_found' });
      return;
    }

    const raw = await readBody(req);
    const presented = req.headers['x-api-key'] || '';
    count += 1;

    const forced = mode;
    const unauthorized = forced === 'unauthorized' || !key || presented !== key;
    if (unauthorized) {
      lastKind = 'unauthorized';
      send(res, 401, { error: 'unauthorized' });
      return;
    }

    let parsed = {};
    try {
      parsed = JSON.parse(raw.toString() || '{}');
    } catch {
      parsed = {};
    }
    const behavior = forced === 'by-address' ? kindFor(parsed.address) : forced;
    lastKind = behavior;

    if (behavior === 'timeout') {
      await new Promise((r) => setTimeout(r, 12_000));
      send(res, 200, { allowed: true, riskScore: 0, reason: 'late' });
      return;
    }
    if (behavior === 'error' || behavior === 'http-500') {
      send(res, 500, { error: 'forced' });
      return;
    }
    if (behavior === 'malformed') {
      send(res, 200, 'not-json{', 'text/plain');
      return;
    }
    if (behavior === 'empty') {
      send(res, 200, {});
      return;
    }
    if (behavior === 'match') {
      send(res, 200, {
        allowed: false,
        riskScore: 100,
        reason: 'Address matches sanctions designation',
      });
      return;
    }
    send(res, 200, { allowed: true, riskScore: 0, reason: 'clear' });
  } catch {
    send(res, 500, { error: 'stub_fault' });
  }
});

server.listen(port, '0.0.0.0');
