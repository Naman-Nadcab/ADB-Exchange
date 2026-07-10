import { describe, it, expect, beforeEach } from '@jest/globals';
import { readCache } from '@core/offline/readCache';

describe('readCache', () => {
  beforeEach(() => {
    readCache.set('test-key', { foo: 'bar' });
  });

  it('stores and retrieves values', () => {
    expect(readCache.get<{ foo: string }>('test-key')?.foo).toBe('bar');
  });

  it('returns savedAt timestamp', () => {
    expect(readCache.getSavedAt('test-key')).toBeGreaterThan(0);
  });
});
