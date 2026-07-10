export type ReconnectPolicy = {
  initialDelayMs: number;
  maxDelayMs: number;
  multiplier: number;
  maxAttempts: number;
};

export const DEFAULT_RECONNECT_POLICY: ReconnectPolicy = {
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  multiplier: 1.5,
  maxAttempts: 12,
};

export function nextReconnectDelay(attempt: number, policy: ReconnectPolicy): number {
  const base = policy.initialDelayMs * Math.pow(policy.multiplier, attempt);
  const capped = Math.min(base, policy.maxDelayMs);
  const jitter = capped * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
}
