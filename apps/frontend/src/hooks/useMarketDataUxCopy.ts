'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';

/** Locale-aware market-data labels and tooltips (pair header, chart strip, dashboard). */
export function useMarketDataUxCopy() {
  const t = useTranslations('crypto.marketData');

  return useMemo(
    () => ({
      NO_TRADES_ACTIONABLE: t('noTradesActionable'),
      NO_TRADES_SHORT: t('noTradesShort'),
      NO_ACTIVITY_24H: t('noActivity24h'),
      NO_ACTIVITY_SHORT: t('noActivityShort'),
      NO_TRADES_TINY: t('noTradesTiny'),
      TOOLTIP_PAIR: t('tooltipPair'),
      TOOLTIP_LAST_PRICE: t('tooltipLastPrice'),
      TOOLTIP_24H_CHANGE: t('tooltip24hChange'),
      TOOLTIP_24H_HIGH: t('tooltip24hHigh'),
      TOOLTIP_24H_LOW: t('tooltip24hLow'),
      TOOLTIP_QUOTE_VOLUME_24H: t('tooltipQuoteVolume24h'),
      TOOLTIP_BASE_VOLUME_24H: t('tooltipBaseVolume24h'),
      TOOLTIP_REFERENCE_VOLUME_24H: t('tooltipReferenceVolume24h'),
      TOOLTIP_CHANGE_UNAVAILABLE: t('tooltipChangeUnavailable'),
    }),
    [t]
  );
}
