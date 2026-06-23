/**
 * Pluggable fiat payout provider abstraction.
 *
 * The default provider is `manual`: it performs no external banking call — the
 * payout is settled by an admin (admin-settled mode). Real providers
 * (Razorpay Payouts, Cashfree Payouts, bank APIs) can be added by implementing
 * FiatPayoutProvider and registering them in the `providers` map, then setting
 * FIAT_PAYOUT_PROVIDER env to its name. No call sites change.
 */

import { logger } from '../lib/logger.js';

export type FiatPayoutStatus = 'manual_pending' | 'submitted' | 'completed' | 'failed';

export interface FiatPayoutRequest {
  withdrawalId: string;
  userId: string;
  currency: string;
  amount: string;
  bankDetails: Record<string, unknown>;
}

export interface FiatPayoutResult {
  status: FiatPayoutStatus;
  reference?: string;
  message?: string;
}

export interface FiatPayoutProvider {
  readonly name: string;
  /** Whether completion is driven externally (webhook) vs. by admin action. */
  readonly autoSettled: boolean;
  initiatePayout(req: FiatPayoutRequest): Promise<FiatPayoutResult>;
}

/**
 * Manual provider — admin-settled. Marks the payout as awaiting manual action;
 * an admin completes it from the admin panel after sending the bank transfer.
 */
class ManualFiatPayoutProvider implements FiatPayoutProvider {
  readonly name = 'manual';
  readonly autoSettled = false;

  async initiatePayout(req: FiatPayoutRequest): Promise<FiatPayoutResult> {
    logger.info('Fiat payout queued for manual settlement', {
      withdrawalId: req.withdrawalId,
      currency: req.currency,
      amount: req.amount,
    });
    return { status: 'manual_pending', message: 'Queued for manual admin settlement' };
  }
}

const providers: Record<string, FiatPayoutProvider> = {
  manual: new ManualFiatPayoutProvider(),
  // razorpay: new RazorpayPayoutProvider(),   // future drop-in
  // cashfree: new CashfreePayoutProvider(),   // future drop-in
};

export function getFiatPayoutProvider(): FiatPayoutProvider {
  const key = (process.env.FIAT_PAYOUT_PROVIDER || 'manual').toLowerCase();
  return providers[key] ?? providers.manual!;
}
