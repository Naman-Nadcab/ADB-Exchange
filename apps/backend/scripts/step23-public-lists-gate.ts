/**
 * In-process gate check for official_public_lists against the isolated database.
 * Refuses the production host and the production database name.
 */
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkSanctions, isSanctionsMatch } from '../src/services/sanctions-screening.service.js';
import {
  OFAC_SDN_ADVANCED_URL,
  publishOfficialPublicListSnapshot,
} from '../src/services/sanctions/official-public-lists.js';

const dbUrl = process.env.DATABASE_URL ?? '';
if (dbUrl.includes('169.58.39.2')) process.exit(1);
const dbName = new URL(dbUrl).pathname.replace(/^\//, '');
if (dbName === 'exchange' || dbName === 'postgres') process.exit(1);

const MATCH = '0x1111111111111111111111111111111111110aaa';
const CLEAR = '0x2222222222222222222222222222222222220c1e';

function fixture(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Sanctions>
  <Feature>
    <FeatureType>Digital Currency Address - ETH</FeatureType>
    <FeatureVersion><VersionDetail>${MATCH}</VersionDetail></FeatureVersion>
  </Feature>
</Sanctions>`;
}

async function main(): Promise<void> {
  assert.equal(process.env.SANCTIONS_PROVIDER, 'official_public_lists');
  const dir = await mkdtemp(path.join(tmpdir(), 'step23-lists-'));
  process.env.SANCTIONS_PUBLIC_LISTS_DIR = dir;

  const missing = await checkSanctions({ address: CLEAR, amount: '12', asset: 'USDT', userId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(missing.allowed, false);
  assert.equal(isSanctionsMatch(missing), false);

  await publishOfficialPublicListSnapshot(dir, fixture(), OFAC_SDN_ADVANCED_URL, new Date());
  const clear = await checkSanctions({ address: CLEAR, amount: '12', asset: 'USDT', userId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(clear.allowed, true, JSON.stringify(clear));
  assert.equal(clear.provider, 'official_public_lists');
  assert.equal(isSanctionsMatch(clear), false);

  const match = await checkSanctions({ address: MATCH, amount: '12', asset: 'USDT', userId: '00000000-0000-4000-8000-000000000001' });
  assert.equal(match.allowed, false);
  assert.equal(match.reason, 'Address matches sanctions designation');
  assert.equal(match.provider, 'official_public_lists');
  assert.equal(isSanctionsMatch(match), true);
  assert.equal(JSON.stringify(match).includes('DistinctParty'), false);
  console.log('STEP23_PUBLIC_LISTS_GATE_PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
