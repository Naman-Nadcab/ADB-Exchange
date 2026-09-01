'use client';

import { ForexAccountBar } from '@/components/forex/ForexAccountBar';
import { hasForexBearer } from '@/lib/forex/api/auth-token';
import { useForexStore } from '@/lib/forex/state/store';

export default function ForexAccountPage() {
  const account = useForexStore((s) => s.account);
  const authed = hasForexBearer();
  return (
    <div className="space-y-3 p-4 text-[12px] md:max-w-lg">
      <h1 className="text-sm font-medium">Forex account</h1>
      {!authed ? (
        <p className="text-stone-500">Private account fields require Authorization: Bearer. Cookie-only sessions cannot authenticate Forex REST.</p>
      ) : account ? (
        <dl className="grid grid-cols-2 gap-2 font-mono">
          <dt className="text-stone-500">Account</dt><dd>{account.accountId}</dd>
          <dt className="text-stone-500">Currency</dt><dd>{account.currency}</dd>
          <dt className="text-stone-500">Ledger</dt><dd>{account.ledgerBalance}</dd>
          <dt className="text-stone-500">Equity</dt><dd>{account.equity}</dd>
          <dt className="text-stone-500">Available</dt><dd>{account.availableBalance}</dd>
          <dt className="text-stone-500">Used margin</dt><dd>{account.usedMargin}</dd>
          <dt className="text-stone-500">Free margin</dt><dd>{account.freeMargin}</dd>
          <dt className="text-stone-500">Margin level</dt><dd>{account.marginLevel ?? '—'}</dd>
          <dt className="text-stone-500">Unrealized</dt><dd>{account.unrealizedPnl}</dd>
          <dt className="text-stone-500">Realized</dt><dd>{account.realizedPnl}</dd>
          <dt className="text-stone-500">Calc</dt><dd>{account.calculationStatus}</dd>
          <dt className="text-stone-500">Price source</dt><dd>{account.priceSource}</dd>
        </dl>
      ) : (
        <p className="text-stone-500">No account payload yet. Waiting for GET /api/v1/forex/account.</p>
      )}
      <div className="md:hidden">
        <ForexAccountBar />
      </div>
    </div>
  );
}
