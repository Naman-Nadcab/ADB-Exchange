import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useWs } from '@app/providers/WsProvider';
import { useAuthStore } from '@core/state/authStore';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { getP2PRepository } from '@core/repositories/P2PRepository';
import { useP2PStore } from '@core/state/p2pStore';
import { appEventBus } from '@core/events/appEventBus';
import { WS_CHANNELS } from '@core/ws/channels';
import type {
  CreateP2PAdRequest,
  UpdateP2PAdRequest,
  CreateP2POrderRequest,
  P2PMessage,
  P2PAd,
  P2PReferencePrice,
  P2POrder,
  P2PPlatformPaymentMethod,
  P2PUserPaymentMethod,
  P2PMerchantStats,
  P2PDispute,
} from '@exchange/mobile-types';

export const P2P_ADS_KEY = ['p2p', 'ads'] as const;
export const P2P_MY_ADS_KEY = ['p2p', 'my-ads'] as const;
export const P2P_ORDERS_KEY = ['p2p', 'orders'] as const;
export const P2P_ORDER_KEY = (id: string) => ['p2p', 'order', id] as const;
export const P2P_MESSAGES_KEY = (id: string) => ['p2p', 'messages', id] as const;
export const P2P_PAYMENT_METHODS_KEY = ['p2p', 'payment-methods'] as const;
export const P2P_MY_PAYMENT_METHODS_KEY = ['p2p', 'my-payment-methods'] as const;
export const P2P_MERCHANT_STATS_KEY = ['p2p', 'merchant-stats'] as const;
export const P2P_DISPUTE_KEY = (id: string) => ['p2p', 'dispute', id] as const;

export function useP2PAds(filters?: {
  type?: string;
  currency?: string;
  fiat?: string;
  advertiser_id?: string;
}) {
  return useInfiniteQuery<P2PAd[], Error, InfiniteData<P2PAd[]>, readonly unknown[], number>({
    queryKey: [...P2P_ADS_KEY, filters],
    queryFn: ({ pageParam }) =>
      getP2PRepository().getAds({ ...filters, limit: 20, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastPageParam) =>
      last.length >= 20 ? lastPageParam + 20 : undefined,
    staleTime: 30_000,
  });
}

export function useP2PReferencePrice(asset: string, fiat: string) {
  return useQuery<P2PReferencePrice | null>({
    queryKey: ['p2p', 'reference-price', asset, fiat],
    queryFn: () => getP2PRepository().getReferencePrice(asset, fiat),
    enabled: !!asset && !!fiat,
    staleTime: 60_000,
  });
}

export function useMyP2PAds() {
  return useQuery<P2PAd[]>({
    queryKey: P2P_MY_ADS_KEY,
    queryFn: () => getP2PRepository().getMyAds(),
    staleTime: 30_000,
  });
}

export function useCreateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateP2PAdRequest) => getP2PRepository().createAd(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: P2P_MY_ADS_KEY }),
  });
}

export function useUpdateAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateP2PAdRequest & { id: string }) =>
      getP2PRepository().updateAd(id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: P2P_MY_ADS_KEY });
      void qc.invalidateQueries({ queryKey: P2P_ADS_KEY });
    },
  });
}

export function useDeleteAd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getP2PRepository().deleteAd(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: P2P_MY_ADS_KEY }),
  });
}

export function useMyP2POrders(status?: string) {
  return useQuery<P2POrder[]>({
    queryKey: [...P2P_ORDERS_KEY, status],
    queryFn: () => getP2PRepository().getMyOrders(status),
    staleTime: 15_000,
  });
}

export function useP2POrder(orderId: string) {
  return useQuery<P2POrder>({
    queryKey: P2P_ORDER_KEY(orderId),
    queryFn: () => getP2PRepository().getOrder(orderId),
    enabled: !!orderId,
    staleTime: 5_000,
  });
}

export function useCreateP2POrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateP2POrderRequest) => getP2PRepository().createOrder(body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: P2P_ORDERS_KEY }),
  });
}

export function useP2POrderActions(orderId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: P2P_ORDER_KEY(orderId) });
    void qc.invalidateQueries({ queryKey: P2P_ORDERS_KEY });
  };
  return {
    confirmPayment: useMutation({
      mutationFn: (body?: { proof_url?: string; transaction_reference?: string }) =>
        getP2PRepository().confirmPayment(orderId, body),
      onSuccess: invalidate,
    }),
    verifyPayment: useMutation({ mutationFn: () => getP2PRepository().verifyPayment(orderId), onSuccess: invalidate }),
    release: useMutation({ mutationFn: () => getP2PRepository().releaseOrder(orderId), onSuccess: invalidate }),
    cancel: useMutation({
      mutationFn: (reason: string) => getP2PRepository().cancelOrder(orderId, reason),
      onSuccess: invalidate,
    }),
    openDispute: useMutation({
      mutationFn: ({ reason, evidence }: { reason: string; evidence?: string[] }) =>
        getP2PRepository().openDispute(orderId, reason, evidence),
      onSuccess: invalidate,
    }),
    uploadProof: useMutation({
      mutationFn: (form: FormData) => getP2PRepository().uploadPaymentProof(orderId, form),
    }),
    submitPay: useMutation({
      mutationFn: (form: FormData) => getP2PRepository().submitPayment(orderId, form),
      onSuccess: invalidate,
    }),
  };
}

export function useP2PMessages(orderId: string) {
  const storeMessages = useP2PStore((s) => s.messagesByOrder[orderId]);
  const setMessages = useP2PStore((s) => s.setMessages);

  const q = useQuery<P2PMessage[]>({
    queryKey: P2P_MESSAGES_KEY(orderId),
    queryFn: () => getP2PRepository().getMessages(orderId),
    enabled: !!orderId,
    staleTime: 5_000,
  });

  useEffect(() => {
    if (q.data) setMessages(orderId, q.data);
  }, [q.data, orderId, setMessages]);

  return { ...q, messages: storeMessages ?? q.data ?? [] };
}

export function useSendP2PMessage(orderId: string) {
  const upsert = useP2PStore((s) => s.upsertMessage);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const clientId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
      const optimistic: P2PMessage = {
        id: clientId,
        orderId,
        senderId: 'self',
        message: text,
        createdAt: new Date().toISOString(),
        _pending: true,
        _clientId: clientId,
      };
      upsert(orderId, optimistic);
      try {
        const res = await getP2PRepository().sendMessage(orderId, text);
        upsert(orderId, { ...res, _clientId: clientId });
        return res;
      } catch (err) {
        upsert(orderId, { ...optimistic, _failed: true });
        throw err;
      }
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: P2P_MESSAGES_KEY(orderId) }),
  });
}

export function useMarkMessagesRead(orderId: string) {
  const markOrderRead = useP2PStore((s) => s.markOrderRead);
  return useMutation({
    mutationFn: (lastId?: string) => getP2PRepository().markMessagesRead(orderId, lastId),
    onSuccess: () => markOrderRead(orderId),
  });
}

export function usePlatformPaymentMethods() {
  return useQuery<P2PPlatformPaymentMethod[]>({
    queryKey: P2P_PAYMENT_METHODS_KEY,
    queryFn: () => getP2PRepository().getPlatformPaymentMethods(),
    staleTime: 300_000,
  });
}

export function useMyPaymentMethods() {
  return useQuery<P2PUserPaymentMethod[]>({
    queryKey: P2P_MY_PAYMENT_METHODS_KEY,
    queryFn: () => getP2PRepository().getMyPaymentMethods(true),
    staleTime: 30_000,
  });
}

export function usePaymentMethodMutations() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: P2P_MY_PAYMENT_METHODS_KEY });
  return {
    add: useMutation({
      mutationFn: (body: {
        payment_method_id: string;
        payment_details?: Record<string, unknown>;
        display_name?: string;
      }) => getP2PRepository().addPaymentMethod(body),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({
        id,
        ...body
      }: {
        id: string;
        is_active?: boolean;
        is_default?: boolean;
        priority?: number;
        payment_details?: Record<string, unknown>;
        display_name?: string;
      }) => getP2PRepository().updatePaymentMethod(id, body),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => getP2PRepository().deletePaymentMethod(id),
      onSuccess: invalidate,
    }),
  };
}

export function useMerchantStats() {
  return useQuery<P2PMerchantStats | null>({
    queryKey: P2P_MERCHANT_STATS_KEY,
    queryFn: () => getP2PRepository().getMerchantStats(),
    staleTime: 60_000,
  });
}

export function useP2PDispute(disputeId: string) {
  return useQuery<P2PDispute>({
    queryKey: P2P_DISPUTE_KEY(disputeId),
    queryFn: () => getP2PRepository().getDispute(disputeId),
    enabled: !!disputeId,
  });
}

export function useBlockAdvertiser() {
  const addBlocked = useP2PStore((s) => s.addBlocked);
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => getP2PRepository().blockAdvertiser(id),
    onSuccess: (_d, id) => {
      addBlocked(id);
      void qc.invalidateQueries({ queryKey: P2P_ADS_KEY });
    },
  });
}

export function useUnblockAdvertiser() {
  const removeBlocked = useP2PStore((s) => s.removeBlocked);
  return useMutation({
    mutationFn: (id: string) => getP2PRepository().unblockAdvertiser(id),
    onSuccess: (_d, id) => removeBlocked(id),
  });
}

export function useP2PSubscriptions(orderId?: string) {
  const { subscriptions, client } = useWs();
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const qc = useQueryClient();
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    let cleanupPrivate: (() => void) | undefined;

    void (async () => {
      try {
        const { ticket } = await getSpotRepository().getWsTicket();
        if (cancelled) return;
        client.authenticate(ticket);
        const u1 = subscriptions.subscribeUserP2POrders();
        cleanupPrivate = u1;
      } catch {
        /* WS optional — REST fallback */
      }
    })();

    const offOrders = appEventBus.on('p2p:orders:invalidate', () => {
      void qc.invalidateQueries({ queryKey: P2P_ORDERS_KEY });
    });
    const offOrder = appEventBus.on('p2p:order:invalidate', (payload) => {
      const p = payload as { orderId?: string };
      if (p?.orderId) void qc.invalidateQueries({ queryKey: P2P_ORDER_KEY(p.orderId) });
    });

    return () => {
      cancelled = true;
      cleanupPrivate?.();
      offOrders();
      offOrder();
    };
  }, [isAuthenticated, client, subscriptions, qc]);

  useEffect(() => {
    if (!orderId || !isAuthenticated) return;
    const unsub = subscriptions.subscribeP2POrderRoom(orderId);
    return () => {
      unsub();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [orderId, isAuthenticated, subscriptions]);

  useEffect(() => () => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
  }, []);

  const sendTyping = useCallback(() => {
    if (!orderId) return;
    client.send({ type: 'p2p_typing', channel: WS_CHANNELS.p2pOrder(orderId) });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      useP2PStore.getState().setTyping(orderId, null);
    }, 3000);
  }, [client, orderId]);

  return { sendTyping };
}
