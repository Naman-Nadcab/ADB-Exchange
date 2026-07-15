import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getP2PRepository } from '@core/repositories/P2PRepository';
import { P2P_AD_KEY } from '@core/domain/p2p/resolveAd';
import { P2P_MY_ADS_KEY } from './useP2P';
import type { CreateP2PAdRequest, P2PAd } from '@exchange/mobile-types';
import { ApiError } from '@core/api/errors/ApiError';

/** ADR-012 — client-side duplicate submission guard for create ad. */
export function useCreateAdSubmit() {
  const qc = useQueryClient();
  const lockRef = useRef(false);

  const submit = useCallback(
    async (body: CreateP2PAdRequest): Promise<P2PAd> => {
      if (lockRef.current) {
        throw new ApiError('Request already in progress', 409, 'DUPLICATE_SUBMIT');
      }
      lockRef.current = true;
      try {
        const ad = await getP2PRepository().createAd(body);
        qc.setQueryData(P2P_AD_KEY(ad.id), ad);
        void qc.invalidateQueries({ queryKey: P2P_MY_ADS_KEY });
        void qc.invalidateQueries({ queryKey: ['p2p', 'ads'] });
        return ad;
      } finally {
        lockRef.current = false;
      }
    },
    [qc],
  );

  return { submit, isLocked: () => lockRef.current };
}
