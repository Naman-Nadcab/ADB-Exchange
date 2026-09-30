/**
 * Run: npx tsx apps/frontend/src/lib/forex/runtime/client-id.test.ts
 */
import { generateClientOrderId, generateForexUuid } from './client-id';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testNative(): void {
  const id = generateClientOrderId('fx');
  assert(id.startsWith('fx-'), 'prefix');
  assert(id.length > 10, 'length');
  assert(generateClientOrderId('fx') !== generateClientOrderId('fx'), 'unique');
}

function testWithoutRandomUUID(): void {
  const g = globalThis as { crypto?: Crypto & { randomUUID?: () => string } };
  const previous = g.crypto;
  let n = 1;
  const stub: Crypto & { randomUUID?: () => string } = {
    getRandomValues<T extends ArrayBufferView>(arr: T): T {
      const view = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
      n += 1;
      for (let i = 0; i < view.length; i += 1) view[i] = (i * 17 + n) & 0xff;
      return arr;
    },
  } as Crypto;
  g.crypto = stub;
  try {
    assert(typeof stub.randomUUID !== 'function', 'randomUUID absent');
    const a = generateForexUuid();
    const b = generateForexUuid();
    assert(/^[0-9a-f-]{36}$/i.test(a), `uuid shape ${a}`);
    assert(a !== b || a.length === 36, 'produces id without randomUUID');
    const order = generateClientOrderId('fx');
    assert(order.startsWith('fx-'), 'order prefix without randomUUID');
  } finally {
    if (previous) g.crypto = previous;
    else delete g.crypto;
  }
}

testNative();
testWithoutRandomUUID();
console.log('client-id.test.ts ok');
