/**
 * Signal copying is stored as a subscription only.
 * This module never places, amends, or cancels an order.
 */
export type ForexCopyEngineStatus = {
  armed: false;
  reason: 'ENGINE_OFF';
};

export function forexCopyEngineStatus(): ForexCopyEngineStatus {
  return { armed: false, reason: 'ENGINE_OFF' };
}
