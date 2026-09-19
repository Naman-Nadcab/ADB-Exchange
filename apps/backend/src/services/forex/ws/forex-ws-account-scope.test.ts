/**
 * WS private events must not cross Forex account boundaries on one user session.
 * Run: npx tsx src/services/forex/ws/forex-ws-account-scope.test.ts
 */
import assert from 'node:assert/strict';
import { forexWsHub } from './hub.js';

function mockSocket() {
  const sent: string[] = [];
  return {
    readyState: 1,
    send: (m: string) => sent.push(m),
    sent,
  };
}

const USER = 'user-ws-scope';
const A1 = 'ACC-A1';
const A2 = 'ACC-A2';

const sockA1 = mockSocket();
const sockA2 = mockSocket();
const idA1 = forexWsHub.register(sockA1 as never, USER, A1);
const idA2 = forexWsHub.register(sockA2 as never, USER, A2);

assert.equal(forexWsHub.subscribe(idA1, 'fx.position'), true);
assert.equal(forexWsHub.subscribe(idA2, 'fx.position'), true);

forexWsHub.publishPrivate(A1, 'fx.position', { source: 'SIMULATED', position: { positionId: 'p1' } });
forexWsHub.publishPrivate(A2, 'fx.position', { source: 'SIMULATED', position: { positionId: 'p2' } });

assert.equal(sockA1.sent.length, 1);
assert.equal(sockA2.sent.length, 1);
assert.ok(sockA1.sent[0]!.includes('p1'));
assert.ok(sockA2.sent[0]!.includes('p2'));
assert.ok(sockA1.sent[0]!.includes(A1));
assert.ok(!sockA1.sent[0]!.includes('p2'));

forexWsHub.setForexAccount(idA1, A2);
sockA1.sent.length = 0;
forexWsHub.publishPrivate(A1, 'fx.position', { source: 'SIMULATED', position: { positionId: 'p1-after-switch' } });
assert.equal(sockA1.sent.length, 0, 'after switch, A1 events must not hit conn bound to A2');

forexWsHub.publishPrivate(A2, 'fx.position', { source: 'SIMULATED', position: { positionId: 'p2-live' } });
assert.equal(sockA1.sent.length, 1);
assert.ok(sockA1.sent[0]!.includes('p2-live'));

console.log('forex-ws-account-scope.test.ts: PASS');
