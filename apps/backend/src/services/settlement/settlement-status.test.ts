import assert from 'node:assert/strict';
import { isTerminalSettlementStatus, SETTLEMENT_STATUS_QUARANTINED } from './settlement-status.js';

{
  assert.equal(isTerminalSettlementStatus('processed'), true);
  assert.equal(isTerminalSettlementStatus('failed'), true);
  assert.equal(isTerminalSettlementStatus('quarantined'), true);
  assert.equal(isTerminalSettlementStatus(SETTLEMENT_STATUS_QUARANTINED), true);
  assert.equal(isTerminalSettlementStatus('pending'), false);
  assert.equal(isTerminalSettlementStatus(''), false);
  assert.equal(isTerminalSettlementStatus(null), false);
}

console.log('settlement-status.test: ok');
