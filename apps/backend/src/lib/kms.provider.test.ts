/**
 * Explicit KMS provider selection and local AES-256-GCM wrapping.
 * Does not call AWS. Does not print key material.
 */
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://exchange:exchange@127.0.0.1:5432/exchange';
process.env.JWT_SECRET = 'test-jwt-secret-must-be-32-characters';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-32-characters-min';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32-characters-min';
process.env.SESSION_SECRET = 'test-session-secret-32-characters-min';
process.env.CSRF_SECRET = 'test-csrf-secret-must-be-32-chars-min';
process.env.KMS_TYPE = 'local';
process.env.LOCAL_KMS_MASTER_KEY = 'aa'.repeat(32);

const { createKeyManagementService, kmsProviderName, loadLocalKmsMasterKey } = await import('./kms.js');
const { evaluateProductionKmsConfig } = await import('./hot-wallet-env.js');

function assertThrows(fn: () => unknown, label: string): void {
  assert.throws(fn, label);
}

async function run(): Promise<void> {
  const aws = createKeyManagementService('aws');
  assert.equal(kmsProviderName(aws), 'aws', 'KMS_TYPE=aws must select the AWS provider');

  const local = createKeyManagementService('local');
  assert.equal(kmsProviderName(local), 'local', 'KMS_TYPE=local must select the local provider');

  const generated = await local.generateDataKey('1');
  assert.equal(generated.plaintextDEK.length, 32);
  assert.ok(generated.encryptedDEK.includes(':'), 'local ciphertext is iv:tag:data');
  const opened = await local.decryptDEK(generated.encryptedDEK, '1');
  assert.ok(generated.plaintextDEK.equals(opened), 'generate/decrypt round trip');

  const other = createKeyManagementService('local');
  const saved = process.env.LOCAL_KMS_MASTER_KEY;
  process.env.LOCAL_KMS_MASTER_KEY = 'bb'.repeat(32);
  await assert.rejects(() => other.decryptDEK(generated.encryptedDEK, '1'), 'wrong key must fail authentication');
  process.env.LOCAL_KMS_MASTER_KEY = saved;

  const parts = generated.encryptedDEK.split(':');
  const flipped = Buffer.from(parts[2]!, 'base64');
  flipped[0] = (flipped[0]! ^ 0xff) & 0xff;
  parts[2] = flipped.toString('base64');
  await assert.rejects(() => local.decryptDEK(parts.join(':'), '1'), 'tampered ciphertext must fail authentication');

  delete process.env.LOCAL_KMS_MASTER_KEY;
  assertThrows(() => loadLocalKmsMasterKey(), 'missing LOCAL_KMS_MASTER_KEY');
  await assert.rejects(() => local.generateDataKey('1'), 'generate without master key must fail');
  process.env.LOCAL_KMS_MASTER_KEY = saved;

  process.env.NODE_ENV = 'production';
  process.env.KMS_TYPE = 'aws';
  process.env.AWS_KMS_KEY_ID = 'alias/example';
  process.env.AWS_REGION = 'us-east-1';
  const awsDecision = evaluateProductionKmsConfig();
  assert.equal(awsDecision.errors.length, 0, 'explicit aws with key id and region is accepted');
  assert.equal(awsDecision.warning, undefined);

  process.env.KMS_TYPE = 'local';
  const localDecision = evaluateProductionKmsConfig();
  assert.equal(localDecision.errors.length, 0, 'explicit local with master key is accepted');
  assert.match(
    localDecision.warning ?? '',
    /LOCAL KMS PROVIDER ACTIVE — NOT SUITABLE FOR MULTI-SERVER PRODUCTION DEPLOYMENT/
  );

  delete process.env.LOCAL_KMS_MASTER_KEY;
  const missing = evaluateProductionKmsConfig();
  assert.ok(missing.errors.some((e) => e.includes('LOCAL_KMS_MASTER_KEY')), 'production local without key fails');

  process.env.KMS_TYPE = 'aws';
  delete process.env.AWS_KMS_KEY_ID;
  const awsMissing = evaluateProductionKmsConfig();
  assert.ok(awsMissing.errors.some((e) => e.includes('AWS_KMS_KEY_ID')), 'aws path still requires AWS_KMS_KEY_ID');

  console.log('PASS: kms provider selection and local AES-256-GCM');
}

run().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
