import { describe, it, expect } from '@jest/globals';
import { withRefreshMutex, resetRefreshMutex } from '@core/auth/refreshMutex';

describe('refresh mutex', () => {
  it('deduplicates concurrent refresh calls', async () => {
    resetRefreshMutex();
    let calls = 0;
    const fn = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return 'token';
    };
    const [a, b] = await Promise.all([withRefreshMutex(fn), withRefreshMutex(fn)]);
    expect(a).toBe('token');
    expect(b).toBe('token');
    expect(calls).toBe(1);
  });
});
