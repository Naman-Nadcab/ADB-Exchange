/**
 * Action-message binding checks that do not open a database.
 * A management message must not be a valid sign-in message.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Wallet } from 'ethers';
import { parseWalletAuthMessage } from './wallet-auth-message.js';
import {
  LINK_STATEMENT,
  SET_PRIMARY_ACTION,
  UNLINK_WALLET_ACTION,
  buildEvmActionTypedData,
  buildLinkMessage,
  buildSolanaActionMessage,
  parseEvmActionTypedData,
  parseLinkMessage,
  parseSolanaActionMessage,
} from './wallet-action-message.js';
import { verifyTypedData } from 'ethers';

async function run(): Promise<void> {
const userId = '11111111-1111-4111-8111-111111111111';
const walletId = '22222222-2222-4222-8222-222222222222';
const otherWalletId = '33333333-3333-4333-8333-333333333333';

const link = buildLinkMessage({
  namespace: 'eip155',
  domain: 'wallet-auth.test:3000',
  address: '0x1111111111111111111111111111111111111111',
  uri: 'http://wallet-auth.test:3000',
  chainReference: '1',
  nonce: 'abc123def456abc123def456abc123de',
  issuedAt: '2026-10-02T10:00:00Z',
  expirationTime: '2026-10-02T10:10:00Z',
  userId,
  provider: 'MetaMask',
});
assert.equal(parseWalletAuthMessage(link), null);
assert.ok(parseLinkMessage(link));
assert.equal(parseLinkMessage(link)?.provider, 'MetaMask');
assert.equal(parseLinkMessage(link.replace(LINK_STATEMENT, 'transfer tokens')), null);

const built = buildEvmActionTypedData({
  action: SET_PRIMARY_ACTION,
  userId,
  targetWalletId: walletId,
  targetAddress: '0x2222222222222222222222222222222222222222',
  chainReference: '1',
  nonce: 'abc123def456abc123def456abc123de',
  issuedAt: '2026-10-02T10:00:00Z',
  expiry: '2026-10-02T10:10:00Z',
  origin: 'http://wallet-auth.test:3000',
});
assert.ok(built);
assert.equal(parseWalletAuthMessage(built.json), null);
const parsed = parseEvmActionTypedData(built.json);
assert.equal(parsed?.message.action, SET_PRIMARY_ACTION);
const wallet = Wallet.createRandom();
const signature = await wallet.signTypedData(parsed!.domain, parsed!.types, parsed!.message);
assert.equal(
  verifyTypedData(parsed!.domain, parsed!.types, parsed!.message, signature).toLowerCase(),
  wallet.address.toLowerCase()
);
const unlink = buildEvmActionTypedData({
  ...{
    action: UNLINK_WALLET_ACTION,
    userId,
    targetWalletId: walletId,
    targetAddress: '0x2222222222222222222222222222222222222222',
    chainReference: '1',
    nonce: 'abc123def456abc123def456abc123de',
    issuedAt: '2026-10-02T10:00:00Z',
    expiry: '2026-10-02T10:10:00Z',
    origin: 'http://wallet-auth.test:3000',
  },
});
assert.ok(unlink);
assert.notEqual(unlink.json, built.json);
assert.equal(parseEvmActionTypedData(unlink.json)?.message.targetWalletId, walletId);
const moved = JSON.parse(built.json) as { message: { targetWalletId: string; statement: string } };
moved.message.targetWalletId = otherWalletId;
assert.equal(parseEvmActionTypedData(JSON.stringify(moved))?.message.targetWalletId, otherWalletId);
moved.message.statement = 'transfer tokens';
assert.equal(parseEvmActionTypedData(JSON.stringify(moved)), null);

const sol = buildSolanaActionMessage({
  domain: 'wallet-auth.test:3000',
  address: 'SoLAddrCaseSensitive1111111111111111111',
  uri: 'http://wallet-auth.test:3000',
  chainReference: 'mainnet',
  nonce: 'abc123def456abc123def456abc123de',
  issuedAt: '2026-10-02T10:00:00Z',
  expirationTime: '2026-10-02T10:10:00Z',
  userId,
  action: UNLINK_WALLET_ACTION,
  walletId,
});
assert.equal(parseWalletAuthMessage(sol), null);
assert.equal(parseSolanaActionMessage(sol)?.address, 'SoLAddrCaseSensitive1111111111111111111');
assert.equal(parseSolanaActionMessage(sol.toLowerCase()), null);

const service = readFileSync(new URL('../services/wallet-management.service.ts', import.meta.url), 'utf8');
assert.doesNotMatch(service, /INSERT INTO (users|wallets|hot_wallets|cold_wallets|user_master_keys|forex_accounts|admin_users)\b/);
assert.match(service, /FOR UPDATE/);
assert.match(service, /status = 'disabled'/);

console.log('PASS: wallet action message binding');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
