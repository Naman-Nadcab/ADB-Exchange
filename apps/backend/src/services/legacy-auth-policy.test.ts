/**
 * Pure cutover decisions. No database and no production mode write.
 */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';

const {
  legacySessionDecision,
  legacySignupAllowed,
  legacyRefreshAllowed,
  customerPasskeyLoginAllowed,
  customerOAuthLoginAllowed,
  walletFirstBlockers,
  legacyDisabledBody,
  LEGACY_DISABLED_MESSAGE,
  LEGACY_SIGNUP_MESSAGE,
  setLegacyAuthModeForTests,
} = await import('./legacy-auth-policy.service.js');

function decision(mode: 'LEGACY_AND_WALLET' | 'WALLET_PREFERRED' | 'WALLET_FIRST' | 'WALLET_ONLY', credentials: number, active: number) {
  return legacySessionDecision({ mode, walletCredentialCount: credentials, activeWalletCount: active });
}

assert.deepEqual(decision('LEGACY_AND_WALLET', 0, 0), { allowed: true, status: 'UNMIGRATED' });
assert.deepEqual(decision('LEGACY_AND_WALLET', 1, 1), { allowed: true, status: 'WALLET_LINKED' });
assert.deepEqual(decision('LEGACY_AND_WALLET', 2, 0), { allowed: true, status: 'UNMIGRATED' });
assert.deepEqual(decision('WALLET_PREFERRED', 1, 1), { allowed: true, status: 'WALLET_LINKED' });
assert.deepEqual(decision('WALLET_FIRST', 0, 0), { allowed: true, status: 'UNMIGRATED' });
assert.deepEqual(decision('WALLET_FIRST', 1, 1), { allowed: false, status: 'LEGACY_DISABLED' });
assert.deepEqual(decision('WALLET_FIRST', 2, 0), { allowed: false, status: 'LEGACY_DISABLED' });
assert.deepEqual(decision('WALLET_ONLY', 0, 0), { allowed: false, status: 'UNMIGRATED' });
assert.deepEqual(decision('WALLET_ONLY', 1, 1), { allowed: false, status: 'LEGACY_DISABLED' });
assert.deepEqual(decision('WALLET_ONLY', 2, 0), { allowed: false, status: 'LEGACY_DISABLED' });

assert.equal(legacySignupAllowed('LEGACY_AND_WALLET'), true);
assert.equal(legacySignupAllowed('WALLET_PREFERRED'), true);
assert.equal(legacySignupAllowed('WALLET_FIRST'), false);
assert.equal(legacySignupAllowed('WALLET_ONLY'), false);
assert.equal(customerPasskeyLoginAllowed('WALLET_FIRST'), true);
assert.equal(customerPasskeyLoginAllowed('WALLET_ONLY'), false);
assert.equal(customerOAuthLoginAllowed('WALLET_PREFERRED'), true);
assert.equal(customerOAuthLoginAllowed('WALLET_ONLY'), false);

for (const method of ['wallet', 'passkey', 'oauth'] as const) {
  assert.equal(legacyRefreshAllowed({ mode: 'WALLET_FIRST', walletCredentialCount: 1, authMethod: method }), true);
}
for (const method of ['password', 'otp', 'legacy', undefined, 'forged'] as const) {
  assert.equal(legacyRefreshAllowed({ mode: 'WALLET_FIRST', walletCredentialCount: 1, authMethod: method }), false);
}
assert.equal(legacyRefreshAllowed({ mode: 'LEGACY_AND_WALLET', walletCredentialCount: 1, authMethod: 'password' }), true);
assert.equal(legacyRefreshAllowed({ mode: 'WALLET_FIRST', walletCredentialCount: 0, authMethod: 'password' }), true);
assert.equal(legacyRefreshAllowed({ mode: 'WALLET_ONLY', walletCredentialCount: 0, authMethod: 'wallet' }), true);
assert.equal(legacyRefreshAllowed({ mode: 'WALLET_ONLY', walletCredentialCount: 1, authMethod: 'wallet' }), true);
for (const method of ['password', 'otp', 'passkey', 'oauth', 'legacy', undefined] as const) {
  assert.equal(legacyRefreshAllowed({ mode: 'WALLET_ONLY', walletCredentialCount: 0, authMethod: method }), false);
}

const blocked = walletFirstBlockers({
  mode: 'LEGACY_AND_WALLET',
  productionCutoverExecuted: false,
  checks: [
    { id: 'providers_ready_for_environment', required: true, ok: false, detail: 'production' },
    { id: 'web3_schema', required: true, ok: false, detail: 'missing' },
    { id: 'note', required: false, ok: false, detail: 'optional' },
  ],
  counts: {
    totalUsers: 0,
    usersWithActiveWallet: 0,
    usersWithoutActiveWallet: 0,
    usersWithPasskey: 0,
    usersWithTotp: 0,
    usersWithEmail: 0,
    usersWithPasswordHash: 0,
    walletNativeUsers: 0,
    eligibleForLegacyDisable: 0,
    blockedByWalletFirst: 0,
  },
});
assert.deepEqual(blocked, ['providers_ready_for_environment', 'web3_schema']);

const body = legacyDisabledBody();
assert.equal(body.error.code, 'LEGACY_AUTH_DISABLED');
assert.equal(body.error.message, LEGACY_DISABLED_MESSAGE);
assert.equal(body.error.message.includes('@'), false);
const signup = legacyDisabledBody(LEGACY_SIGNUP_MESSAGE, 'LEGACY_SIGNUP_CLOSED');
assert.equal(signup.error.message, 'Connect your wallet to continue.');

const previous = process.env.NODE_ENV;
process.env.NODE_ENV = 'development';
assert.throws(() => setLegacyAuthModeForTests('WALLET_FIRST'), /test-only/);
process.env.NODE_ENV = previous;

console.log('legacy-auth-policy decisions: PASS');
