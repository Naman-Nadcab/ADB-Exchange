/**
 * Signature and message-binding checks that do not open a database.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { ed25519 } from '@noble/curves/ed25519';
import { Wallet } from 'ethers';
import { decodeBase58 } from '../lib/base58.js';
import { parseWalletAuthMessage } from '../lib/wallet-auth-message.js';
import {
  AUTH_ONLY_STATEMENT,
  buildAuthMessage,
} from './wallet-auth-challenge.service.js';
import {
  ISSUED_AT_SKEW_MS,
  WALLET_AUTH_EIP1271_ENABLED,
  verifyEvmEoaSignature,
  verifySolanaSignature,
} from './wallet-auth-verify.service.js';

const FRONTEND_DOMAIN = 'wallet-auth.test:3000';
const FRONTEND_URI = 'http://wallet-auth.test:3000';

function evmMessage(address: string, nonce = 'abc123def456abc123def456abc123de'): string {
  return buildAuthMessage({
    namespace: 'eip155',
    domain: FRONTEND_DOMAIN,
    address,
    uri: FRONTEND_URI,
    chainReference: '1',
    nonce,
    issuedAt: '2026-10-02T10:00:00Z',
    expirationTime: '2026-10-02T10:10:00Z',
  });
}

function signSolana(message: string, secret: Uint8Array): string {
  const signature = ed25519.sign(new TextEncoder().encode(message), secret);
  return bs58.encode(signature);
}

async function run(): Promise<void> {
  assert.equal(WALLET_AUTH_EIP1271_ENABLED, false);
  assert.equal(ISSUED_AT_SKEW_MS, 60_000);

  const wallet = Wallet.createRandom();
  const message = evmMessage(wallet.address);
  const parsed = parseWalletAuthMessage(message);
  assert.ok(parsed);
  assert.equal(parsed.namespace, 'eip155');
  assert.equal(parsed.domain, FRONTEND_DOMAIN);
  assert.equal(parsed.uri, FRONTEND_URI);
  assert.equal(parsed.address, wallet.address);
  assert.equal(parsed.chainReference, '1');
  assert.equal(parsed.statement, AUTH_ONLY_STATEMENT);
  assert.equal(parsed.nonce, 'abc123def456abc123def456abc123de');

  const signature = await wallet.signMessage(message);
  assert.equal(verifyEvmEoaSignature(message, signature, wallet.address.toLowerCase()), true);
  assert.equal(verifyEvmEoaSignature(`${message} `, signature, wallet.address.toLowerCase()), false);
  assert.equal(verifyEvmEoaSignature(message.replace(FRONTEND_DOMAIN, 'attacker.example'), signature, wallet.address.toLowerCase()), false);
  assert.equal(verifyEvmEoaSignature(message, await Wallet.createRandom().signMessage(message), wallet.address.toLowerCase()), false);
  assert.equal(verifyEvmEoaSignature(message, `0x${'ab'.repeat(32)}`, wallet.address.toLowerCase()), false);
  assert.equal(verifyEvmEoaSignature(message, `0x${'11'.repeat(65)}`, wallet.address.toLowerCase()), false);

  const changed = parseWalletAuthMessage(message.replace('Chain ID: 1', 'Chain ID: 5'));
  assert.ok(changed);
  assert.equal(changed.chainReference, '5');
  assert.equal(parseWalletAuthMessage(message.replace('Version: 1', 'Version: 2')), null);
  assert.equal(parseWalletAuthMessage(message.replace(AUTH_ONLY_STATEMENT, 'transfer tokens')), null);

  const sol = Keypair.generate();
  const solAddress = sol.publicKey.toBase58();
  const solMessage = buildAuthMessage({
    namespace: 'solana',
    domain: FRONTEND_DOMAIN,
    address: solAddress,
    uri: FRONTEND_URI,
    chainReference: 'mainnet',
    nonce: 'abc123def456abc123def456abc123de',
    issuedAt: '2026-10-02T10:00:00Z',
    expirationTime: '2026-10-02T10:10:00Z',
  });
  const solParsed = parseWalletAuthMessage(solMessage);
  assert.ok(solParsed);
  assert.equal(solParsed.namespace, 'solana');
  assert.equal(solParsed.chainReference, 'mainnet');
  assert.equal(solParsed.address, solAddress);
  const solSignature = signSolana(solMessage, sol.secretKey.slice(0, 32));
  assert.equal(verifySolanaSignature(solMessage, solSignature, solAddress), true);
  assert.equal(verifySolanaSignature(`${solMessage}\n`, solSignature, solAddress), false);
  assert.equal(verifySolanaSignature(solMessage, solSignature, solAddress.slice(0, -1) + (solAddress.endsWith('1') ? '2' : '1')), false);
  const other = Keypair.generate();
  assert.equal(verifySolanaSignature(solMessage, signSolana(solMessage, other.secretKey.slice(0, 32)), solAddress), false);

  const decoded = decodeBase58(solAddress);
  assert.ok(Buffer.from(decoded).equals(Buffer.from(sol.publicKey.toBytes())));
  assert.throws(() => decodeBase58('0OIl'));

  const serviceSrc = readFileSync(new URL('./wallet-auth-verify.service.ts', import.meta.url), 'utf8');
  const routeSrc = readFileSync(new URL('../routes/auth-wallet-verify.fastify.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(serviceSrc, /createSession|INSERT INTO users|user_wallets|user_sessions|forex_accounts|user_balances|eth_recover/i);
  assert.doesNotMatch(routeSrc, /createSession|setCookie|admin_users|user_wallets/);
  assert.match(serviceSrc, /FOR UPDATE/);
  assert.match(serviceSrc, /consumed_at IS NULL/);

  console.log('PASS: wallet signature unit tests');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
