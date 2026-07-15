/** ADR-011: resolve P2P ads without false not-found from page-1-only scans. */

import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import type { P2PAd } from '@exchange/mobile-types';
import { getP2PRepository } from '@core/repositories/P2PRepository';

export const P2P_ADS_LIST_KEY = ['p2p', 'ads'] as const;
export const P2P_AD_KEY = (id: string) => ['p2p', 'ad', id] as const;

export class P2PAdNotFoundError extends Error {
  constructor() {
    super('Ad not found');
    this.name = 'P2PAdNotFoundError';
  }
}

function findInPages(pages: P2PAd[][], adId: string): P2PAd | undefined {
  for (const page of pages) {
    const hit = page.find((a) => a.id === adId);
    if (hit) return hit;
  }
  return undefined;
}

/** Priority 2 — search react-query caches before network pagination. */
export function findAdInQueryCache(queryClient: QueryClient, adId: string): P2PAd | undefined {
  const dedicated = queryClient.getQueryData<P2PAd>(P2P_AD_KEY(adId));
  if (dedicated?.id === adId) return dedicated;

  const entries = queryClient.getQueriesData<P2PAd[] | InfiniteData<P2PAd[]>>({ queryKey: P2P_ADS_LIST_KEY });
  for (const [, data] of entries) {
    if (!data) continue;
    if (Array.isArray(data)) {
      const hit = data.find((a) => a.id === adId);
      if (hit) return hit;
    } else if (data.pages) {
      const hit = findInPages(data.pages, adId);
      if (hit) return hit;
    }
  }
  return undefined;
}

export type AdLookupHints = {
  type?: string;
  currency?: string;
  fiat?: string;
  advertiser_id?: string;
};

async function paginateAds(adId: string, hints?: AdLookupHints): Promise<P2PAd | null> {
  const limit = 50;
  let offset = 0;
  while (true) {
    const page = await getP2PRepository().getAds({ ...hints, limit, offset });
    const hit = page.find((a) => a.id === adId);
    if (hit) return hit;
    if (page.length < limit) return null;
    offset += limit;
  }
}

/** Priority 3 — paginate until found or exhausted. Tries hinted query first, then unfiltered. */
export async function resolveP2PAdById(adId: string, hints?: AdLookupHints): Promise<P2PAd> {
  if (hints && Object.keys(hints).length > 0) {
    const hinted = await paginateAds(adId, hints);
    if (hinted) return hinted;
  }
  const broad = await paginateAds(adId);
  if (broad) return broad;
  throw new P2PAdNotFoundError();
}

export function adLookupHintsFromSeed(seed?: P2PAd): AdLookupHints | undefined {
  if (!seed) return undefined;
  const hints: AdLookupHints = {};
  const side = (seed.ad_type ?? seed.type)?.toLowerCase();
  if (side === 'buy' || side === 'sell') hints.type = side;
  if (seed.crypto_symbol) hints.currency = seed.crypto_symbol;
  if (seed.fiat_currency) hints.fiat = seed.fiat_currency;
  if (seed.user_id) hints.advertiser_id = seed.user_id;
  return Object.keys(hints).length > 0 ? hints : undefined;
}
