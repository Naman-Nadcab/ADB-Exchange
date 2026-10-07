import assert from 'node:assert/strict';
import { shortAddress, sameWalletAddress } from './display';

assert.equal(shortAddress('0x1234567890abcdef1234567890ABCDEF12345678'), '0x1234…5678');
assert.equal(shortAddress('short'), 'short');
assert.equal(sameWalletAddress('eip155', '0xABCD', '0xabcd'), true);
assert.equal(sameWalletAddress('solana', 'SoLanaAddr', 'solanaaddr'), false);
assert.equal(sameWalletAddress('solana', 'SoLanaAddr', 'SoLanaAddr'), true);
console.log('PASS: wallet address display');
