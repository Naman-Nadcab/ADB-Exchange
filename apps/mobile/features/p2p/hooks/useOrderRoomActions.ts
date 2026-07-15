import { useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getP2PRepository } from '@core/repositories/P2PRepository';
import { mmkvStorage } from '@core/storage/mmkvStorage';
import { CACHE_KEYS } from '@core/storage/cacheKeys';
import { ApiError } from '@core/api/errors/ApiError';
import type { P2POrder } from '@exchange/mobile-types';
import { P2P_ORDER_KEY, P2P_ORDERS_KEY } from './useP2P';

type PayProof = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

type OrderRoomDraft = {
  txRef?: string;
};

function randomKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function readIdempotencyKey(orderId: string, action: string): string {
  const key = CACHE_KEYS.p2pOrderRoomIdempotency(orderId, action);
  const existing = mmkvStorage.getString(key);
  if (existing) return existing;
  const created = randomKey();
  mmkvStorage.set(key, created);
  return created;
}

function clearIdempotencyKey(orderId: string, action: string): void {
  mmkvStorage.remove(CACHE_KEYS.p2pOrderRoomIdempotency(orderId, action));
}

function readDraft(orderId: string): OrderRoomDraft {
  const raw = mmkvStorage.getString(CACHE_KEYS.p2pOrderRoomDraft(orderId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as OrderRoomDraft;
  } catch {
    return {};
  }
}

function writeDraft(orderId: string, draft: OrderRoomDraft): void {
  mmkvStorage.set(CACHE_KEYS.p2pOrderRoomDraft(orderId), JSON.stringify(draft));
}

function clearDraft(orderId: string): void {
  mmkvStorage.remove(CACHE_KEYS.p2pOrderRoomDraft(orderId));
}

/** ADR-012/013 — stable idempotency keys + client lock for order room mutations. */
export function useOrderRoomActions(orderId: string) {
  const qc = useQueryClient();
  const lockRef = useRef(false);

  const invalidate = useCallback(() => {
    void qc.invalidateQueries({ queryKey: P2P_ORDER_KEY(orderId) });
    void qc.invalidateQueries({ queryKey: P2P_ORDERS_KEY });
  }, [qc, orderId]);

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

  const submitPay = useCallback(
    async (proof: PayProof, transactionReference: string): Promise<P2POrder> =>
      withLock(async () => {
        const idempotencyKey = readIdempotencyKey(orderId, 'pay');
        writeDraft(orderId, { txRef: transactionReference.trim() });

        const form = new FormData();
        form.append('payment_proof_file', {
          uri: proof.uri,
          type: proof.mimeType ?? 'image/jpeg',
          name: proof.fileName ?? 'payment-proof.jpg',
        } as unknown as Blob);
        form.append('transaction_reference', transactionReference.trim());

        try {
          const order = await getP2PRepository().submitPayment(orderId, form, idempotencyKey);
          clearDraft(orderId);
          qc.setQueryData(P2P_ORDER_KEY(orderId), order);
          invalidate();
          return order;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'PAYMENT_NOT_VERIFIED') {
            clearIdempotencyKey(orderId, 'pay');
          }
          throw err;
        }
      }),
    [orderId, withLock, qc, invalidate],
  );

  const verifyPayment = useCallback(
    async (): Promise<P2POrder> =>
      withLock(async () => {
        const order = await getP2PRepository().verifyPayment(orderId);
        qc.setQueryData(P2P_ORDER_KEY(orderId), order);
        invalidate();
        return order;
      }),
    [orderId, withLock, qc, invalidate],
  );

  const release = useCallback(
    async (): Promise<P2POrder> =>
      withLock(async () => {
        const idempotencyKey = readIdempotencyKey(orderId, 'release');
        try {
          const order = await getP2PRepository().releaseOrder(orderId, idempotencyKey);
          qc.setQueryData(P2P_ORDER_KEY(orderId), order);
          invalidate();
          return order;
        } catch (err) {
          if (err instanceof ApiError && err.code === 'PAYMENT_NOT_VERIFIED') {
            clearIdempotencyKey(orderId, 'release');
          }
          throw err;
        }
      }),
    [orderId, withLock, qc, invalidate],
  );

  const cancel = useCallback(
    async (reason: string): Promise<P2POrder> =>
      withLock(async () => {
        const idempotencyKey = readIdempotencyKey(orderId, 'cancel');
        const order = await getP2PRepository().cancelOrder(orderId, reason.trim(), idempotencyKey);
        qc.setQueryData(P2P_ORDER_KEY(orderId), order);
        invalidate();
        return order;
      }),
    [orderId, withLock, qc, invalidate],
  );

  const openDispute = useCallback(
    async (reason: string, evidence?: string[]): Promise<{ id: string }> =>
      withLock(async () => {
        const res = await getP2PRepository().openDispute(orderId, reason.trim(), evidence);
        invalidate();
        return res;
      }),
    [orderId, withLock, invalidate],
  );

  return {
    submitPay,
    verifyPayment,
    release,
    cancel,
    openDispute,
    isLocked: () => lockRef.current,
    readDraft: () => readDraft(orderId),
    persistTxRef: (txRef: string) => writeDraft(orderId, { txRef }),
  };
}

export type { PayProof, OrderRoomDraft };
