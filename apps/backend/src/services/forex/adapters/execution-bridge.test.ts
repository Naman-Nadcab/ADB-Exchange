import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

describe('assertBrokerAdapterReadyForExecution', () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it('passes through when adapter hook is disabled', async () => {
    delete process.env.FOREX_ADAPTER_LAYER_HOOK;
    const { assertBrokerAdapterReadyForExecution } = await import('./execution-bridge.js');
    const res = await assertBrokerAdapterReadyForExecution();
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.adapterId).toBe('internal-fdm');
  });
});
