/**
 * FDM Forex product labels. Master brand lives in `@/lib/brand`.
 */
import { BRAND_NAME_SHORT, BRAND_PRODUCT } from '@/lib/brand';

export const FOREX_PRODUCT = {
  name: 'Forex',
  productName: BRAND_PRODUCT.forex,
  shortName: 'FX',
  platform: BRAND_NAME_SHORT,
  status: 'DEMO · SIMULATED',
  statusConnected: 'DEMO · SIMULATED',
  execution: 'MOCK',
  source: 'SIMULATED',
  disclaimer: 'SIMULATED / MOCK · not a live broker',
} as const;
