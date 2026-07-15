import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  setPendingAuthResume,
  consumePendingAuthResume,
  clearPendingAuthResume,
  hasPendingAuthResume,
} from '@core/guest/authIntent';

describe('authIntent', () => {
  beforeEach(() => {
    clearPendingAuthResume();
  });

  it('runs pending resume once on consume', () => {
    let ran = 0;
    setPendingAuthResume(() => {
      ran += 1;
    });
    expect(hasPendingAuthResume()).toBe(true);
    consumePendingAuthResume();
    expect(ran).toBe(1);
    expect(hasPendingAuthResume()).toBe(false);
    consumePendingAuthResume();
    expect(ran).toBe(1);
  });

  it('clears pending resume without running', () => {
    let ran = 0;
    setPendingAuthResume(() => {
      ran += 1;
    });
    clearPendingAuthResume();
    consumePendingAuthResume();
    expect(ran).toBe(0);
  });
});
