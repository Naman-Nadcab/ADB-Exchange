'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function P2PLegacyRedirect() {
  const router = useRouter();
  const params = useParams();
  const t = useTranslations('p2p');
  const type = (params?.type as string) || 'buy';
  const crypto = (params?.crypto as string) || 'USDT';
  const fiat = (params?.fiat as string) || 'USD';
  useEffect(() => {
    router.replace('/p2p');
  }, [router, type, crypto, fiat]);
  return (
    <div className="min-h-screen bg-muted flex items-center justify-center">
      <p className="text-muted-foreground">{t('redirectLegacy')}</p>
    </div>
  );
}
