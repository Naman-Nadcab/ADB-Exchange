/**
 * Isolated certification of the repository Rust matching-engine binary.
 * This is not the HTTP stub on 127.0.0.1:18099 and it must not use production.
 *
 * The engine match log is an HMAC service feed. Customer order ownership is
 * enforced by the spot routes (user_id predicate) before they call this client.
 */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';

const PORT = 17101;
const BASE = `http://127.0.0.1:${PORT}`;
const ENGINE_ID = 'step19';
const SECRET = 'step19-engine-hmac-secret-32chars-min';
const REDIS = process.env.STEP19_ENGINE_REDIS_URL?.trim() || 'redis://127.0.0.1:6386/4';
const BIN =
  process.env.STEP19_ENGINE_BIN?.trim() ||
  '/workspace/matching-engine/target/release/matching-engine';
const WAL = '/tmp/step19-engine/wal.log';
const SNAP = '/tmp/step19-engine/snap.json';
const USER_A = 'a19a0000-0000-4000-8000-0000000000a1';
const USER_B = 'a19b0000-0000-4000-8000-0000000000b2';

const redisUrl = new URL(REDIS);
if (redisUrl.port === '6379' || (redisUrl.hostname !== '127.0.0.1' && redisUrl.hostname !== 'localhost')) {
  console.error('Refusing non-local engine Redis');
  process.exit(1);
}
if (BASE.includes('169.58.39.2')) process.exit(1);

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.MATCHING_ENGINE_URL = BASE;
process.env.MATCHING_ENGINE_INSTANCE_IDS = ENGINE_ID;
process.env.ENGINE_HMAC_SECRET_ACTIVE = SECRET;
process.env.ENGINE_HMAC_SECRET = SECRET;
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY ?? 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = process.env.CSRF_SECRET ?? 'test-csrf-secret-must-be-32-chars-min';
process.env.REDIS_URL = REDIS;
process.env.EXCHANGE_PRESERVE_SHELL_DATABASE_URL = '1';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://step18:step18cert@127.0.0.1:54344/step19run';

function engineEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ENGINE_HTTP_BIND: '127.0.0.1',
    ENGINE_HTTP_PORT: String(PORT),
    ENGINE_INSTANCE_ID: ENGINE_ID,
    ENGINE_HMAC_SECRET_ACTIVE: SECRET,
    ENGINE_HMAC_SECRET: SECRET,
    ENGINE_REDIS_URL: REDIS,
    ENGINE_MATCH_WAL_PATH: WAL,
    ENGINE_PERSISTENCE_SNAPSHOT_PATH: SNAP,
    ENGINE_SNAPSHOT_INTERVAL_SECS: '5',
    ENGINE_WAL_COMPACT_ON_START: 'false',
    USE_EVENT_STREAM: 'false',
  };
  delete env.ENGINE_BACKEND_URL;
  delete env.NATS_URL;
  return env;
}

function startEngine(): ChildProcess {
  const child = spawn(BIN, [], {
    env: engineEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.on('data', (buf) => process.stdout.write(`[engine] ${buf}`));
  child.stderr?.on('data', (buf) => process.stderr.write(`[engine] ${buf}`));
  return child;
}

async function stopEngine(child: ChildProcess | null): Promise<void> {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const t = setTimeout(() => {
      child.kill('SIGKILL');
      resolve(undefined);
    }, 2000);
    child.once('exit', () => {
      clearTimeout(t);
      resolve(undefined);
    });
  });
}

async function waitHealth(timeoutMs = 15000): Promise<Record<string, unknown>> {
  const started = Date.now();
  let last = '';
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return (await res.json()) as Record<string, unknown>;
      last = `${res.status}`;
    } catch (e) {
      last = e instanceof Error ? e.message : String(e);
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`engine health timeout: ${last}`);
}

async function main(): Promise<void> {
  mkdirSync('/tmp/step19-engine', { recursive: true });
  if (!existsSync(BIN)) {
    console.error(`REAL_RUST_ENGINE NOT VERIFIED: binary missing at ${BIN}`);
    process.exit(2);
  }
  const { signEngineHmacV2 } = await import('./engine-hmac.js');
  const { placeOrderRust, cancelOrderRustOnEngine } = await import('./engine-client.js');

  await new Promise<void>((resolve, reject) => {
    const rm = spawn('rm', ['-f', WAL, SNAP]);
    rm.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`rm wal ${code}`))));
  });

  let engine = startEngine();
  try {
    const health = await waitHealth();
    assert.equal(health.ok, true);
    assert.equal(health.engine_id, ENGINE_ID);
    assert.equal(health.match_wal_enabled, true);
    assert.equal(health.stream_publish_mode, 'off');
    assert.equal(String(health.status), 'healthy');
    console.log('PASS rust engine health on 127.0.0.1:' + PORT + ' engine_id=' + ENGINE_ID);

    const unsigned = await fetch(`${BASE}/engine/place`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    assert.equal(unsigned.status, 401);
    console.log('PASS unsigned place rejected');

    const order = (userId: string, side: 'BUY' | 'SELL', price: string) => ({
      id: randomUUID(),
      user_id: userId,
      market: 'BTC_USDT',
      side,
      type: 'LIMIT' as const,
      price,
      quantity: '1',
      remaining: '1',
      created_at: Date.now(),
    });

    async function signed(method: 'GET' | 'POST', urlPath: string, body: string, userId: string, engineId = ENGINE_ID) {
      const nonce = `${Date.now()}-${randomUUID().slice(0, 8)}`;
      const signature = signEngineHmacV2(SECRET, userId, engineId, method, urlPath, body, nonce);
      return fetch(`${BASE}/engine${urlPath}`, {
        method,
        headers: {
          'content-type': 'application/json',
          'x-signature': signature,
          'x-nonce': nonce,
          'x-user-id': userId,
          'x-engine-id': engineId,
        },
        body: method === 'GET' ? undefined : body,
      });
    }

    const bad = await signed('POST', '/place', '{"nope":1}', USER_A);
    assert.ok(bad.status === 400 || bad.status === 422, `invalid order status ${bad.status}`);
    console.log('PASS invalid order rejected ' + bad.status);

    const skew = `${Date.now() - 120_000}-expired`;
    const skewBody = JSON.stringify(order(USER_A, 'BUY', '10'));
    const skewSig = signEngineHmacV2(SECRET, USER_A, ENGINE_ID, 'POST', '/place', skewBody, skew);
    const expired = await fetch(`${BASE}/engine/place`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-signature': skewSig,
        'x-nonce': skew,
        'x-user-id': USER_A,
        'x-engine-id': ENGINE_ID,
      },
      body: skewBody,
    });
    assert.equal(expired.status, 401);
    console.log('PASS expired nonce rejected');

    const mismatch = await signed('POST', '/place', JSON.stringify(order(USER_A, 'BUY', '10')), USER_A, 'other-engine');
    assert.equal(mismatch.status, 403);
    console.log('PASS engine id mismatch rejected');

    const replayBody = JSON.stringify(order(USER_A, 'BUY', '9'));
    const replayNonce = `${Date.now()}-${randomUUID().slice(0, 8)}`;
    const replaySig = signEngineHmacV2(SECRET, USER_A, ENGINE_ID, 'POST', '/place', replayBody, replayNonce);
    const replayHeaders = {
      'content-type': 'application/json',
      'x-signature': replaySig,
      'x-nonce': replayNonce,
      'x-user-id': USER_A,
      'x-engine-id': ENGINE_ID,
    };
    const firstReplay = await fetch(`${BASE}/engine/place`, { method: 'POST', headers: replayHeaders, body: replayBody });
    assert.equal(firstReplay.status, 200, await firstReplay.text());
    const secondReplay = await fetch(`${BASE}/engine/place`, { method: 'POST', headers: replayHeaders, body: replayBody });
    assert.equal(secondReplay.status, 401);
    console.log('PASS nonce replay rejected');

    const resting = order(USER_A, 'BUY', '10');
    const placed = await placeOrderRust(
      {
        id: resting.id,
        user_id: resting.user_id,
        market: resting.market,
        side: 'buy',
        type: 'limit',
        price: resting.price,
        quantity: resting.quantity,
        remaining: resting.remaining,
        created_at: resting.created_at,
      },
      { baseUrl: BASE, engineId: ENGINE_ID }
    );
    assert.equal(placed.ok, true);
    assert.equal(placed.engineId, ENGINE_ID);
    assert.equal(placed.events?.length ?? 0, 0);
    console.log('PASS backend placeOrderRust resting buy for users.id ' + USER_A);

    const taker = order(USER_B, 'SELL', '10');
    const filled = await placeOrderRust(
      {
        id: taker.id,
        user_id: taker.user_id,
        market: taker.market,
        side: 'sell',
        type: 'limit',
        price: taker.price,
        quantity: taker.quantity,
        remaining: taker.remaining,
        created_at: taker.created_at,
      },
      { baseUrl: BASE, engineId: ENGINE_ID }
    );
    assert.equal(filled.ok, true);
    assert.ok((filled.events?.length ?? 0) >= 1, JSON.stringify(filled.events));
    const event = filled.events![0]!;
    const owners = new Set([event.taker_user_id, event.maker_user_id]);
    assert.equal(owners.has(USER_A), true);
    assert.equal(owners.has(USER_B), true);
    console.log('PASS fill event carries both users.id values and no other owner');

    const matchesA = await signed('GET', '/matches?after_id=0', '', USER_A);
    assert.equal(matchesA.status, 200);
    const matchesBody = (await matchesA.json()) as { events: Array<{ taker_user_id: string; maker_user_id: string }> };
    assert.ok(matchesBody.events.some((e) => e.taker_user_id === USER_B || e.maker_user_id === USER_B));
    const matchesOpen = await fetch(`${BASE}/engine/matches?after_id=0`);
    assert.equal(matchesOpen.status, 401);
    console.log('PASS match feed requires HMAC; unsigned caller cannot read fills');

    const another = order(USER_A, 'BUY', '8');
    const resting2 = await placeOrderRust(
      {
        id: another.id,
        user_id: another.user_id,
        market: another.market,
        side: 'buy',
        type: 'limit',
        price: another.price,
        quantity: another.quantity,
        remaining: another.remaining,
        created_at: another.created_at,
      },
      { baseUrl: BASE, engineId: ENGINE_ID }
    );
    assert.equal(resting2.ok, true);
    await new Promise((r) => setTimeout(r, 6500));
    const snapBefore = await signed('GET', '/snapshot?market=BTC_USDT', '', USER_A);
    assert.equal(snapBefore.status, 200);
    const snapBeforeText = await snapBefore.text();
    assert.equal(snapBeforeText.includes(another.id), true);
    assert.equal(snapBeforeText.includes(USER_A), true);

    await stopEngine(engine);
    engine = startEngine();
    const recovered = await waitHealth();
    assert.equal(recovered.ok, true);
    const snapAfter = await signed('GET', '/snapshot?market=BTC_USDT', '', USER_A);
    const snapAfterText = await snapAfter.text();
    assert.equal(snapAfter.status, 200);
    assert.equal(snapAfterText.includes(another.id), true, snapAfterText.slice(0, 400));
    console.log('PASS engine restart reloaded the isolated snapshot');

    const cancelled = await cancelOrderRustOnEngine(another.id, ENGINE_ID, USER_A);
    assert.equal(cancelled.ok, true);
    const snapCancel = await signed('GET', '/snapshot?market=BTC_USDT', '', USER_A);
    const snapCancelText = await snapCancel.text();
    assert.equal(snapCancelText.includes(another.id), false, snapCancelText.slice(0, 500));
    console.log('PASS cancel removed the resting order owned by ' + USER_A);

    await stopEngine(engine);
    engine = null;
    await assert.rejects(() =>
      placeOrderRust(
        {
          id: randomUUID(),
          user_id: USER_A,
          market: 'BTC_USDT',
          side: 'buy',
          type: 'limit',
          price: '1',
          quantity: '1',
          remaining: '1',
          created_at: Date.now(),
        },
        { baseUrl: BASE, engineId: ENGINE_ID }
      )
    );
    console.log('PASS place fails when the engine process is down');

    const blackhole = net.createServer();
    await new Promise<void>((resolve) => blackhole.listen(17199, '127.0.0.1', () => resolve()));
    const slowStarted = Date.now();
    await assert.rejects(() =>
      placeOrderRust(
        {
          id: randomUUID(),
          user_id: USER_A,
          market: 'BTC_USDT',
          side: 'buy',
          type: 'limit',
          price: '1',
          quantity: '1',
          remaining: '1',
          created_at: Date.now(),
        },
        { baseUrl: 'http://127.0.0.1:17199', engineId: ENGINE_ID }
      )
    );
    const elapsed = Date.now() - slowStarted;
    blackhole.close();
    assert.ok(elapsed >= 4500, `timeout too fast ${elapsed}`);
    console.log('PASS engine timeout surfaced from placeOrderRust after ' + elapsed + 'ms');
    console.log('REAL_RUST_ENGINE_PASS');
    process.exit(0);
  } finally {
    await stopEngine(engine);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
