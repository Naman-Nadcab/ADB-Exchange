/**
 * Phase 2 — Customer Stop Limit + Time in Force exposure (targeted).
 * Complements forex-phase-a-orders.test.ts and forex-phase1c-stoplimit-tif.test.ts.
 *
 * Run: FOREX_SILENT_LOG=1 npx tsx src/services/forex/forex-phase2-customer-terminal.test.ts
 */
import assert from 'node:assert/strict';
import { getForexCustomerTradingConfig } from './admin/config.js';
import {
  FOREX_CUSTOMER_EXPOSED_ORDER_TYPES,
  FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE,
  getForexCustomerCapabilityContract,
} from './capabilities/customer-contract.js';
import { pendingTriggerValid } from './orders/pending.js';
import { validateForexOrderRequest } from './orders/validate.js';
import { resetForexSessionExceptionsForTests, setForexSessionNowForTests } from './sessions/eligibility.js';

/** Monday midday UTC — within 24x5 NY session (validation is session-gated). */
const OPEN_SESSION_CLOCK = new Date('2026-09-07T16:00:00.000Z');
resetForexSessionExceptionsForTests();
setForexSessionNowForTests(OPEN_SESSION_CLOCK);

// --- A. Capability contract ---
{
  const c = getForexCustomerCapabilityContract();
  assert.deepEqual(c.customer.orderTypes, [...FOREX_CUSTOMER_EXPOSED_ORDER_TYPES]);
  assert.deepEqual(c.customer.timeInForce, [...FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE]);
  assert.ok(c.orderTypes.stopLimit.customerExposed);
  assert.ok(c.timeInForce.gtc.customerExposed);
  assert.ok(c.timeInForce.day.customerExposed);
  assert.ok(c.timeInForce.ioc.customerExposed);
  assert.ok(c.timeInForce.fok.customerExposed);
  assert.equal(c.timeInForce.gtd.engine, true);
  assert.ok(c.timeInForce.gtd.customerExposed);
  assert.equal(c.realForex, false);
  console.log('  PASS  Phase 2 capability contract');
}

{
  const cfg = getForexCustomerTradingConfig();
  assert.deepEqual(cfg.orderTypes, ['market', 'limit', 'stop', 'stop_limit']);
  assert.deepEqual(cfg.timeInForce, ['GTC', 'IOC', 'FOK', 'DAY', 'GTD', 'RETURN', 'BOC']);
  assert.equal(cfg.orderModel, 'side_x_kind');
  assert.deepEqual(cfg.orderKinds, ['market', 'limit', 'stop', 'stop_limit']);
  assert.deepEqual(cfg.allowedSides, ['buy', 'sell']);
  assert.equal(cfg.customerOrderPaths?.length, 8);
  assert.equal(cfg.capabilities?.version, 1);
  console.log('  PASS  trading-config API shape');
}

// --- B/C. Stop + stop_limit validation matrix ---
{
  const base = { clientOrderId: 'p2', symbol: 'EURUSD', volume: '0.10', timeInForce: 'GTC' as const };
  assert.equal(validateForexOrderRequest({ ...base, side: 'buy', orderType: 'stop', requestedPrice: '1.17000' }).ok, true);
  assert.equal(validateForexOrderRequest({ ...base, side: 'sell', orderType: 'stop', requestedPrice: '1.16000' }).ok, true);
  assert.equal(
    validateForexOrderRequest({
      ...base,
      side: 'buy',
      orderType: 'stop_limit',
      requestedPrice: '1.17000',
      limitPrice: '1.16900',
    }).ok,
    true
  );
  assert.equal(
    validateForexOrderRequest({
      ...base,
      side: 'sell',
      orderType: 'stop_limit',
      requestedPrice: '1.16000',
      limitPrice: '1.16100',
    }).ok,
    true
  );
  const noLimit = validateForexOrderRequest({ ...base, side: 'buy', orderType: 'stop_limit', requestedPrice: '1.17000' });
  assert.equal(noLimit.ok, false);
  const noStop = validateForexOrderRequest({ ...base, side: 'buy', orderType: 'stop_limit', limitPrice: '1.16900' });
  assert.equal(noStop.ok, false);
  const badRel = pendingTriggerValid({
    orderType: 'stop_limit',
    side: 'buy',
    requestedPrice: '1.17000',
    limitPrice: '1.17100',
  });
  assert.equal(badRel.ok, false);
  console.log('  PASS  stop / stop_limit validation matrix');
}

// --- D. TIF rejection rules ---
{
  const base = {
    clientOrderId: 'p2-tif',
    symbol: 'EURUSD',
    side: 'buy' as const,
    volume: '0.10',
    requestedPrice: '1.17000',
  };
  assert.equal(validateForexOrderRequest({ ...base, orderType: 'limit', timeInForce: 'DAY' }).ok, true);
  assert.equal(validateForexOrderRequest({ ...base, orderType: 'market', timeInForce: 'IOC' }).ok, true);
  assert.equal(validateForexOrderRequest({ ...base, orderType: 'market', timeInForce: 'FOK' }).ok, true);
  const iocPending = validateForexOrderRequest({ ...base, orderType: 'stop', timeInForce: 'IOC' });
  assert.equal(iocPending.ok, false);
  const dayMarket = validateForexOrderRequest({ ...base, orderType: 'market', timeInForce: 'DAY' });
  assert.equal(dayMarket.ok, false);
  const gtd = validateForexOrderRequest({ ...base, orderType: 'market', timeInForce: 'GTD' as never });
  assert.equal(gtd.ok, false);
  console.log('  PASS  TIF combination rules');
}

setForexSessionNowForTests(null);
resetForexSessionExceptionsForTests();
console.log('\nforex-phase2-customer-terminal.test.ts — all passed\n');
