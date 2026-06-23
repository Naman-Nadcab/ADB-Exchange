'use client';

import Link from 'next/link';
import { Banknote, Coins, ChevronRight } from 'lucide-react';
import { WalletOperationsShell } from '@/components/wallet/WalletOperationsShell';
import { walletPath } from '@/lib/routes';

export default function WalletWithdrawHubPage() {
  return (
    <WalletOperationsShell
      title="Withdraw"
      description="Choose how you want to withdraw — crypto on-chain or INR to your bank account."
    >
      <div className="mx-auto grid max-w-2xl gap-4">
        <Link
          href={walletPath.withdrawCrypto}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">Crypto withdrawal</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Send BTC, ETH, USDT and other assets to an external wallet.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <Link
          href={walletPath.withdrawFiat}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
            <Banknote className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">INR withdrawal</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Withdraw INR balance to a saved bank account or UPI.</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <p className="text-center text-xs text-muted-foreground">
          Bank account save karna ho to{' '}
          <Link href={walletPath.paymentMethods} className="text-primary hover:underline font-medium">
            Payment methods
          </Link>{' '}
          page par jao.
        </p>
      </div>
    </WalletOperationsShell>
  );
}
