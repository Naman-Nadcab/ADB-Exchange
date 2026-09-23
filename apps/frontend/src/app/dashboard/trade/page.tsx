'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function TradeRedirectToSpot() {
  const router = useRouter();
  const t = useTranslations('wallet');
  useEffect(() => {
    router.replace('/trade/spot');
  }, [router]);
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <p className="text-muted-foreground">{t('redirectSpot')}</p>
    </div>
  );
}
