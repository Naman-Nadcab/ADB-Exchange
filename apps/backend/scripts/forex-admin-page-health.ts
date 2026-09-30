/**
 * Forex admin page + API health probe (cert :4100 and live :4000/:80).
 * Output: .build/forex-admin-page-health.json
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(process.cwd(), '../..');
const out = path.join(root, '.build/forex-admin-page-health.json');

type Row = {
  href: string;
  live_http: number | null;
  cert_http: number | null;
  api_cert: number | null;
  notes: string;
};

async function code(url: string, init?: RequestInit): Promise<number | null> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
    return res.status;
  } catch {
    return null;
  }
}

async function main() {
  const nav = readFileSync(path.join(root, 'apps/admin-panel/src/lib/admin/forex-admin-nav.ts'), 'utf8');
  const hrefs = [...nav.matchAll(/href: '(\/forex[^']*)'/g)].map((m) => m[1]);
  const unique = [...new Set(hrefs)];

  const certLogin = await fetch('http://127.0.0.1:4100/api/v1/admin/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'cert_maker@cert.local', password: 'CertAdmin1!' }),
  }).then((r) => r.json() as Promise<{ data?: { accessToken?: string } }>);
  const certToken = certLogin.data?.accessToken ?? '';

  const rows: Row[] = [];
  for (const href of unique) {
    const live = await code(`http://109.123.254.30/admin${href}`);
    const certUi = await code(`http://127.0.0.1:3010/admin${href}`);
    let apiCert: number | null = null;
    if (certToken && href.startsWith('/forex')) {
      const apiPath = href.replace(/^\/forex/, '/forex').replace(/\/crm\/clients\/[^/]+/, '/forex/crm/clients/CERT_ACC_B');
      const probe =
        apiPath === '/forex'
          ? '/forex/overview'
          : apiPath.includes('/crm/clients/') && !apiPath.endsWith('CERT_ACC_B')
            ? '/forex/crm/clients'
            : apiPath;
      apiCert = await code(`http://127.0.0.1:4100/api/v1/admin${probe}`, {
        headers: { authorization: `Bearer ${certToken}` },
      });
    }
    rows.push({
      href,
      live_http: live,
      cert_http: certUi,
      api_cert: apiCert,
      notes: live === 200 ? 'live shell OK' : live === 404 ? 'missing on live admin' : 'check auth or server',
    });
  }

  const doc = {
    generated_at: new Date().toISOString(),
    probes: rows,
    summary: {
      live_200: rows.filter((r) => r.live_http === 200).length,
      cert_200: rows.filter((r) => r.cert_http === 200).length,
      total: rows.length,
    },
  };
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(doc, null, 2));
  console.log(JSON.stringify(doc.summary));
}

void main();
