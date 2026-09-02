/**
 * Public homepage commercial copy invariants.
 * Run: npx tsx apps/frontend/src/lib/eda/eda-public-home.test.ts
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const home = readFileSync(resolve(here, '../../components/eda/EdaPublicHome.tsx'), 'utf8');
const footer = readFileSync(resolve(here, '../../components/eda/EdaPublicFooter.tsx'), 'utf8');

const banned = [
  'backend-authoritative',
  'mock LP',
  'DST IANA',
  'Not a live trading terminal',
  'Illustrative interface',
  'Ledger cash',
  'World\'s fastest',
  'Zero latency',
  'Institutional liquidity',
];
for (const phrase of banned) {
  assert(!home.includes(phrase), `home must not contain "${phrase}"`);
}

const required = [
  'Global markets.',
  'One platform.',
  'Explore Markets',
  'Create Account',
  'Digital Asset Markets',
  'Global FX Markets',
  'Built for precision',
  'Built on a financial core',
  'Complete account visibility',
  'Product preview',
  'Available after sign-in',
  'Security built into the platform',
  'Market intelligence',
  'Ready for the markets?',
];
for (const phrase of required) {
  assert(home.includes(phrase), `home must contain "${phrase}"`);
}

assert(footer.includes('Markets'), 'footer Markets');
assert(footer.includes('Legal'), 'footer Legal');
assert(footer.includes('ROUTES.terms'), 'footer Terms uses real route');
assert(footer.includes('FOREX_ROUTES.trade'), 'footer Forex uses real route');

console.log('eda-public-home.test.ts ok');
