import test from 'node:test';
import assert from 'node:assert/strict';
import { interpretCutoverBody } from './cutover';

test('a missing or failed cutover read keeps email sign-in open', () => {
  assert.deepEqual(interpretCutoverBody(null), { walletPrimary: false, legacyEntryAvailable: true });
  assert.deepEqual(interpretCutoverBody({}), { walletPrimary: false, legacyEntryAvailable: true });
  assert.deepEqual(interpretCutoverBody({ data: {} }), { walletPrimary: false, legacyEntryAvailable: true });
});

test('wallet-only is the only view that closes email sign-in', () => {
  assert.deepEqual(
    interpretCutoverBody({ data: { mode: 'WALLET_ONLY', walletPrimary: true, legacyEntryAvailable: false } }),
    { walletPrimary: true, legacyEntryAvailable: false },
  );
});

test('legacy and wallet stays open and is not wallet-primary unless the server says so', () => {
  assert.deepEqual(
    interpretCutoverBody({ data: { mode: 'LEGACY_AND_WALLET', walletPrimary: false, legacyEntryAvailable: true } }),
    { walletPrimary: false, legacyEntryAvailable: true },
  );
});
