export type RetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxAttempts: 2,
  baseDelayMs: 300,
  maxDelayMs: 2_000,
};

export function shouldRetry(status: number, attempt: number, policy: RetryPolicy): boolean {
  if (attempt >= policy.maxAttempts) return false;
  return status === 408 || status === 429 || status >= 500;
}

export function retryDelayMs(attempt: number, policy: RetryPolicy): number {
  const exp = policy.baseDelayMs * Math.pow(2, attempt);
  return Math.min(exp, policy.maxDelayMs);
}
