import assert from 'node:assert/strict';
import { buildPresetPolicy } from './compliance-policy.service.js';
import { COMPLIANCE_OPERATIONS } from '../types/compliance-policy.js';

{
  const p = buildPresetPolicy('closed_beta');
  for (const op of COMPLIANCE_OPERATIONS) {
    assert.equal(p.kyc[op], 'disabled');
    assert.equal(p.aml[op], 'disabled');
  }
  assert.equal(p.environmentLabel, 'Closed Beta');
}

{
  const p = buildPresetPolicy('production');
  assert.equal(p.kyc.withdrawal, 'required');
  assert.equal(p.kyc.signup, 'required');
  assert.equal(p.aml.withdrawal, 'strict_blocking');
  assert.equal(p.aml.deposit, 'manual_review');
}

{
  const p = buildPresetPolicy('internal_qa');
  assert.equal(p.kyc.spot_trading, 'disabled');
  assert.equal(p.aml.p2p, 'disabled');
}

console.log('compliance-policy.service.test: ok');
