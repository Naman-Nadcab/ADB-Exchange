import { describeCustomerOrder, orderKindHelp } from './order-type-tif';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

assert(describeCustomerOrder('buy', 'market') === 'Market Buy', 'market buy');
assert(describeCustomerOrder('sell', 'limit') === 'Sell Limit', 'sell limit');
assert(describeCustomerOrder('buy', 'stop_limit') === 'Buy Stop Limit', 'buy stop limit');
assert(orderKindHelp('stop', 'buy').includes('Ask'), 'buy stop uses ask');
assert(orderKindHelp('stop', 'sell').includes('Bid'), 'sell stop uses bid');
console.log('order-type-tif.test.ts ok');
