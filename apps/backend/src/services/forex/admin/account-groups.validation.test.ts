import assert from 'node:assert/strict';

const GROUP_CODE = /^[A-Z0-9_]{2,32}$/;

function run(): void {
  assert.equal(GROUP_CODE.test('RETAIL_STD'), true);
  assert.equal(GROUP_CODE.test('retail'), false);
  assert.equal(GROUP_CODE.test('A'), false);
  assert.equal(GROUP_CODE.test('BAD-CODE'), false);
  console.log('account-groups.validation.test.ts PASS');
}

run();
