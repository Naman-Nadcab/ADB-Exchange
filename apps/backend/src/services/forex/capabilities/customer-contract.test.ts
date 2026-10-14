/**
 * Run: npx tsx apps/backend/src/services/forex/capabilities/customer-contract.test.ts
 */
import {
  FOREX_CUSTOMER_EXPOSED_ORDER_TYPES,
  FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE,
  FOREX_ENGINE_ORDER_TYPES,
  FOREX_ENGINE_TIME_IN_FORCE,
  getForexCustomerCapabilityContract,
} from './customer-contract.js';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

{
  const c = getForexCustomerCapabilityContract();
  assert(c.realForex === false, 'realForex false');
  assert(c.orderTypes.stopLimit.engine === true, 'engine stop_limit');
  assert(c.orderTypes.stopLimit.customerExposed === true, 'customer stop_limit exposed');
  assert(c.orderTypes.stopLimit.runtimeCertification === 'MOCK_ONLY', 'stop_limit runtime certified MOCK');
  assert(c.timeInForce.day.customerExposed === true, 'customer DAY exposed');
  assert(c.timeInForce.day.runtimeCertification === 'MOCK_ONLY', 'DAY runtime certified MOCK');
  assert(c.timeInForce.ioc.customerExposed === true, 'customer IOC exposed');
  assert(c.timeInForce.ioc.runtimeCertification === 'MOCK_ONLY', 'IOC runtime certified MOCK');
  assert(c.timeInForce.fok.customerExposed === true, 'customer FOK exposed');
  assert(c.timeInForce.fok.runtimeCertification === 'MOCK_ONLY', 'FOK runtime certified MOCK');
  assert(c.timeInForce.gtd.engine === true, 'GTD engine');
  assert(c.timeInForce.gtd.customerExposed === true, 'GTD exposed');
  assert(c.protections.trailing.customerExposed === true, 'trailing customer exposed');
  assert(c.positionModes.netting.customerExposed === true, 'netting exposed');
  assert(c.positionActions.closeBy.customerExposed === true, 'closeBy exposed when hedging');
  assert(JSON.stringify(c.customer.orderTypes) === JSON.stringify([...FOREX_CUSTOMER_EXPOSED_ORDER_TYPES]), 'customer orderTypes');
  assert(JSON.stringify(c.customer.timeInForce) === JSON.stringify([...FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE]), 'customer tif');
  assert(FOREX_ENGINE_ORDER_TYPES.includes('stop_limit'), 'engine list');
  assert(FOREX_CUSTOMER_EXPOSED_ORDER_TYPES.includes('stop_limit'), 'exposed stop_limit');
  assert(JSON.stringify([...FOREX_CUSTOMER_EXPOSED_TIME_IN_FORCE]) === JSON.stringify(['GTC', 'IOC', 'FOK', 'DAY', 'GTD', 'RETURN', 'BOC']), 'exposed tif list');
  assert(JSON.stringify([...FOREX_ENGINE_TIME_IN_FORCE]) === JSON.stringify(['GTC', 'IOC', 'FOK', 'DAY', 'GTD', 'RETURN', 'BOC']), 'engine tif');
  assert(c.timeInForce.return.engine === true, 'RETURN engine');
  assert(c.timeInForce.boc.engine === true, 'BOC engine');
  console.log('  PASS  canonical capability contract tri-state');
}

console.log('\ncustomer-contract.test.ts — all passed\n');
