/**
 * Fixture tests for the OFAC public-list provider. No network. No vendor payload.
 */
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  OFAC_SDN_ADVANCED_URL,
  extractOfacDigitalCurrencyAddresses,
  publishOfficialPublicListSnapshot,
  readOfficialPublicListsHealth,
  refreshOfficialPublicLists,
  screenOfficialPublicLists,
} from './official-public-lists.js';

const MATCH = '0x1111111111111111111111111111111111110aaa';
const OTHER = '0x2222222222222222222222222222222222220bbb';
const BTC = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';

function fixture(extra = ''): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Sanctions>
  <DistinctParty>
    <Feature>
      <FeatureType>Digital Currency Address - ETH</FeatureType>
      <FeatureVersion><VersionDetail>${MATCH}</VersionDetail></FeatureVersion>
    </Feature>
    <Feature>
      <FeatureType>Digital Currency Address - XBT</FeatureType>
      <FeatureVersion><VersionDetail>${BTC}</VersionDetail></FeatureVersion>
    </Feature>
  </DistinctParty>
  ${extra}
</Sanctions>`;
}

async function tempRoot(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), 'ofac-lists-'));
}

async function testPublishedFeatureTypeIds(): Promise<void> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Sanctions>
  <ReferenceValueSets>
    <FeatureType ID="345" FeatureTypeGroupID="1">Digital Currency Address - ETH</FeatureType>
    <FeatureType ID="25">Other</FeatureType>
  </ReferenceValueSets>
  <DistinctParty>
    <Feature ID="1" FeatureTypeID="345">
      <FeatureVersion ID="2"><VersionDetail DetailTypeID="1432">${MATCH}</VersionDetail></FeatureVersion>
    </Feature>
    <Feature ID="3" FeatureTypeID="25">
      <FeatureVersion ID="4"><VersionDetail>not-a-wallet</VersionDetail></FeatureVersion>
    </Feature>
  </DistinctParty>
</Sanctions>`;
  const addresses = extractOfacDigitalCurrencyAddresses(xml);
  assert.deepEqual(addresses, [MATCH]);
  console.log('PASS published FeatureTypeID address extraction');
}

async function testExtractAndScreen(): Promise<void> {
  const addresses = extractOfacDigitalCurrencyAddresses(fixture());
  assert.deepEqual(addresses, [BTC, MATCH].sort());
  const root = await tempRoot();
  const manifest = await publishOfficialPublicListSnapshot(root, fixture(), OFAC_SDN_ADVANCED_URL, new Date('2026-10-03T00:00:00Z'));
  assert.equal(manifest.addressCount, 2);
  assert.equal(manifest.source, 'ofac-sdn');
  const now = new Date('2026-10-03T01:00:00Z');
  const clear = await screenOfficialPublicLists({ address: OTHER, dir: root, now });
  assert.equal(clear.allowed, true);
  const match = await screenOfficialPublicLists({ address: MATCH.toUpperCase(), dir: root, now });
  assert.equal(match.allowed, false);
  assert.equal(match.reason, 'Address matches sanctions designation');
  const near = await screenOfficialPublicLists({ address: `${MATCH.slice(0, -1)}b`, dir: root, now });
  assert.equal(near.allowed, true);
  const btcFlip = await screenOfficialPublicLists({ address: BTC.toLowerCase(), dir: root, now });
  assert.equal(btcFlip.allowed, true);
  const btc = await screenOfficialPublicLists({ address: BTC, dir: root, now });
  assert.equal(btc.allowed, false);
  const noAddress = await screenOfficialPublicLists({ address: '   ', dir: root, now });
  assert.equal(noAddress.allowed, false);
  assert.equal(noAddress.reason, 'Sanctions service unavailable');
  console.log('PASS extract, clear, exact match, ambiguous near-match');
}

async function testRejectedUpdatesKeepPrevious(): Promise<void> {
  const root = await tempRoot();
  const now = new Date('2026-10-03T00:00:00Z');
  await publishOfficialPublicListSnapshot(root, fixture(), OFAC_SDN_ADVANCED_URL, now);
  const cases: Array<[string, string]> = [
    ['empty', '<Sanctions></Sanctions>'],
    ['partial', `${fixture().replace('</Sanctions>', '')} <FeatureType>Digital Currency Address - ETH</FeatureType>`],
    ['corrupt', 'this is not xml'],
    ['tiny', '<Sanctions/>'],
  ];
  for (const [label, xml] of cases) {
    await assert.rejects(() => publishOfficialPublicListSnapshot(root, xml, OFAC_SDN_ADVANCED_URL, now), label);
    const health = await readOfficialPublicListsHealth(root, now);
    assert.equal(health.status, 'ready', label);
    assert.equal(health.addressCount, 2, label);
  }
  console.log('PASS corrupted, partial, and empty updates keep the previous snapshot');
}

async function testChecksumAndStale(): Promise<void> {
  const root = await tempRoot();
  const published = new Date('2026-10-01T00:00:00Z');
  await publishOfficialPublicListSnapshot(root, fixture(), OFAC_SDN_ADVANCED_URL, published);
  const addressesPath = path.join(root, 'current', 'addresses.json');
  const original = await readFile(addressesPath, 'utf8');
  await writeFile(addressesPath, original.replace(MATCH, OTHER));
  const corrupt = await readOfficialPublicListsHealth(root, published);
  assert.equal(corrupt.status, 'corrupt');
  const blocked = await screenOfficialPublicLists({ address: MATCH, dir: root, now: published });
  assert.equal(blocked.reason, 'Sanctions service unavailable');
  await writeFile(addressesPath, original);
  const staleNow = new Date('2026-10-04T00:00:00Z');
  const stale = await readOfficialPublicListsHealth(root, staleNow, 24 * 60 * 60 * 1000);
  assert.equal(stale.status, 'stale');
  const staleScreen = await screenOfficialPublicLists({
    address: OTHER,
    dir: root,
    now: staleNow,
    maxAgeMs: 24 * 60 * 60 * 1000,
  });
  assert.equal(staleScreen.allowed, false);
  assert.equal(staleScreen.reason, 'Sanctions service unavailable');
  const missing = await readOfficialPublicListsHealth(path.join(root, 'does-not-exist'), published);
  assert.equal(missing.status, 'missing');
  console.log('PASS checksum mismatch, stale data, and missing dataset fail closed');
}

async function testRefreshDoesNotReplaceOnFailure(): Promise<void> {
  const root = await tempRoot();
  await publishOfficialPublicListSnapshot(root, fixture(), OFAC_SDN_ADVANCED_URL, new Date('2026-10-03T00:00:00Z'));
  await assert.rejects(() => refreshOfficialPublicLists({
    dir: root,
    timeoutMs: 20,
    fetchImpl: () => new Promise(() => undefined) as Promise<Response>,
  }));
  await assert.rejects(() => refreshOfficialPublicLists({
    dir: root,
    fetchImpl: async (url) => {
      assert.equal(url, OFAC_SDN_ADVANCED_URL);
      return new Response('nope', { status: 500 });
    },
  }));
  await assert.rejects(() => refreshOfficialPublicLists({
    dir: root,
    fetchImpl: async () => new Response('<Sanctions></Sanctions>', { status: 200 }),
  }));
  const health = await readOfficialPublicListsHealth(root, new Date('2026-10-03T01:00:00Z'));
  assert.equal(health.status, 'ready');
  assert.equal(health.addressCount, 2);
  const updated = await refreshOfficialPublicLists({
    dir: root,
    now: new Date('2026-10-03T02:00:00Z'),
    fetchImpl: async (url) => {
      assert.equal(String(url), OFAC_SDN_ADVANCED_URL);
      return new Response(fixture(), { status: 200 });
    },
  });
  assert.equal(updated.addressCount, 2);
  assert.equal(updated.downloadedAt, '2026-10-03T02:00:00.000Z');
  console.log('PASS timeout, HTTP error, empty download, and good refresh');
}

async function main(): Promise<void> {
  await testPublishedFeatureTypeIds();
  await testExtractAndScreen();
  await testRejectedUpdatesKeepPrevious();
  await testChecksumAndStale();
  await testRefreshDoesNotReplaceOnFailure();
  console.log('OFFICIAL_PUBLIC_LISTS_PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
