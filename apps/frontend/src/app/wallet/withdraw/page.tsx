'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Banknote, Coins, ChevronRight } from 'lucide-react';
import { WalletOperationsShell } from '@/components/wallet/WalletOperationsShell';
import { walletPath } from '@/lib/routes';

export default function WalletWithdrawHubPage() {
  const tw = useTranslations('wallet.withdrawHub');

  return (
    <WalletOperationsShell title={tw('title')} description={tw('description')}>
      <div className="mx-auto grid max-w-2xl gap-4">
        <Link
          href={walletPath.withdrawCrypto}
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm transition-colors hover:border-primary/35 hover:bg-accent/30"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Coins className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-foreground">{tw('cryptoTitle')}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{tw('cryptoDesc')}</p>
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
            <h2 className="font-semibold text-foreground">{tw('inrTitle')}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{tw('inrDesc')}</p>
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>

        <p className="text-center text-xs text-muted-foreground">
          {tw('bankHintBefore')}{' '}
          <Link href={walletPath.paymentMethods} className="text-primary hover:underline font-medium">
            {tw('paymentMethods')}
          </Link>{' '}
          {tw('bankHintAfter')}
        </p>
      </div>
    </WalletOperationsShell>
  );
}
