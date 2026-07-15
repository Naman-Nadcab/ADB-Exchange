import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getP2PRepository } from '@core/repositories/P2PRepository';
import { ApiError } from '@core/api/errors/ApiError';
import type { P2PUserPaymentMethod } from '@exchange/mobile-types';
import { P2P_MY_PAYMENT_METHODS_KEY } from './useP2P';

/** ADR-012 — client-side duplicate submission guard for payment method mutations. */
export function usePaymentMethodActions() {
  const qc = useQueryClient();
  const lockRef = useRef(false);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: P2P_MY_PAYMENT_METHODS_KEY });
  }, [qc]);

  const withLock = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    if (lockRef.current) {
      throw new ApiError('Request already in progress', 409, 'DUPLICATE_SUBMIT');
    }
    lockRef.current = true;
    try {
      return await fn();
    } finally {
      lockRef.current = false;
    }
  }, []);

  const add = useCallback(
    (body: { payment_method_id: string; payment_details?: Record<string, unknown>; display_name?: string }) =>
      withLock(async () => {
        const method = await getP2PRepository().addPaymentMethod(body);
        invalidate();
        return method;
      }),
    [withLock, invalidate],
  );

  const update = useCallback(
    (
      id: string,
      body: { is_active?: boolean; payment_details?: Record<string, unknown>; display_name?: string },
    ) =>
      withLock(async () => {
        const method = await getP2PRepository().updatePaymentMethod(id, body);
        qc.setQueryData<P2PUserPaymentMethod[]>(P2P_MY_PAYMENT_METHODS_KEY, (prev) =>
          prev?.map((m) => (m.id === id ? { ...m, ...method } : m)),
        );
        invalidate();
        return method;
      }),
    [withLock, invalidate, qc],
  );

  const remove = useCallback(
    (id: string) =>
      withLock(async () => {
        const res = await getP2PRepository().deletePaymentMethod(id);
        invalidate();
        return res;
      }),
    [withLock, invalidate],
  );

  const toggleActive = useCallback(
    (id: string, active: boolean) => update(id, { is_active: active }),
    [update],
  );

  return { add, update, remove, toggleActive, isLocked: () => lockRef.current };
}
