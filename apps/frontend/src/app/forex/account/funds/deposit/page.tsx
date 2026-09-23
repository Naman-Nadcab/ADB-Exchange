'use client';

import { useTranslations } from 'next-intl';
import { ForexFundingUnavailablePanel } from '@/components/forex/ForexFundingUnavailablePanel';
import { ForexFundsSubNav } from '@/components/forex/ForexFundsSubNav';
import { ForexPageFrame } from '@/components/forex/ForexPageFrame';
import { ForexPortalAccountContext } from '@/components/forex/ForexPortalAccountContext';
import { useForexProductGates } from '@/lib/forex/hooks/useForexProductGates';

export default function ForexFundsDepositPage() {
  const tf = useTranslations('forex');
  const { gates } = useForexProductGates();

  return (
    <ForexPageFrame title={tf('pages.fundsDeposit.title')} subtitle={tf('pages.fundsDeposit.subtitle')}>
      <ForexPortalAccountContext />
      <ForexFundsSubNav />
      {!gates.realFundingEnabled ? <ForexFundingUnavailablePanel variant="deposit" /> : null}
    </ForexPageFrame>
  );
}
