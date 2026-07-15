import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { useWs } from '@app/providers/WsProvider';
import { useAuthStore } from '@core/state/authStore';
import { getSpotRepository } from '@core/repositories/SpotRepository';
import { getP2PRepository } from '@core/repositories/P2PRepository';
import { useP2PStore } from '@core/state/p2pStore';
import {
  findAdInQueryCache,
  resolveP2PAdById,
  adLookupHintsFromSeed,
  P2PAdNotFoundError,
  P2P_AD_KEY,
} from '@core/domain/p2p/resolveAd';
import { appEventBus } from '@core/events/appEventBus';
import { WS_CHANNELS } from '@core/ws/channels';
import type {
  CreateP2PAdRequest,
  UpdateP2PAdRequest,
  CreateP2POrderRequest,
  P2PMessage,
  P2PAd,
  P2POrder,
  P2PUserPaymentMethod,
} from '@exchange/mobile-types';
import { findPaymentMethodInCache } from '@core/domain/p2p/paymentMethods';
import {
  findMerchantSeedInCache,
  merchantProfileFromAds,
} from '@core/domain/p2p/merchant';
import {
  findOrderInQueryCache,
  isTerminalOrderStatus,
  P2POrderNotFoundError,
  P2P_ORDER_QUERY_KEY,
} from '@core/domain/p2p/orderRoom';
import { useWsMetricsStore } from '@core/state/wsMetricsStore';

export const P2P_ADS_KEY = ['p2p', 'ads'] as const;
export const P2P_MY_ADS_KEY = ['p2p', 'my-ads'] as const;
export const P2P_ORDERS_KEY = ['p2p', 'orders'] as const;
export const P2P_ORDER_KEY = (id: string) => ['p2p', 'order', id] as const;
export const P2P_MESSAGES_KEY = (id: string) => ['p2p', 'messages', id] as const;
export const P2P_PAYMENT_METHODS_KEY = ['p2p', 'payment-methods'] as const;
export const P2P_MY_PAYMENT_METHODS_KEY = ['p2p', 'my-payment-methods'] as const;
export const P2P_MERCHANT_STATS_KEY = ['p2p', 'merchant-stats'] as const;
export const P2P_MERCHANT_PROFILE_KEY = (id: string) => ['p2p', 'merchant-profile', id] as const;
export const P2P_DISPUTE_KEY = (id: string) => ['p2p', 'dispute', id] as const;

export function useP2PAds(filters?: {
  type?: string;
  currency?: string;
  fiat?: string;
  advertiser_id?: string;
}) {
  return useInfiniteQuery({
    queryKey: [...P2P_ADS_KEY, filters],
    queryFn: ({ pageParam = 0 }) =>
      getP2PRepository().getAds({ ...filters, limit: 20, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, _pages, lastPageParam) =>
      last.length >= 20 ? lastPageParam + 20 : undefined,
    staleTime: 30_000,
  });
}

/** Marketplace listing — single fetch of 50 ads matching website p2p-v2. */
export function useP2PMarketplaceAds(filters: {
  type: string;
  currency: string;
  fiat: string;
}) {
  return useQuery({
    queryKey: [...P2P_ADS_KEY, 'marketplace', filters],
    queryFn: () => getP2PRepository().getAds({ ...filters, limit: 50, offset: 0 }),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    enabled: !!filters.type && !!filters.currency && !!filters.fiat,
  });
}

export function useSpotTickersForP2P() {
  return useQuery({
    queryKey: ['spot', 'tickers', 'p2p'],
    queryFn: () => getSpotRepository().getTickers(),
    staleTime: 15_000,
    refetchInterval: 15_000,
  });
}

/** ADR-011 ad detail resolver — seed/cache first, paginate until found. */
export function useP2PAdDetail(adId: string, seedAd?: P2PAd) {
  const qc = useQueryClient();
  const hints = adLookupHintsFromSeed(seedAd);

  return useQuery({
    queryKey: P2P_AD_KEY(adId),
    queryFn: async () => {
      const cached = findAdInQueryCache(qc, adId);
      if (cached) return cached;
      return resolveP2PAdById(adId, hints);
    },
    initialData: () => {
      if (seedAd?.id === adId) return seedAd;
      return findAdInQueryCache(qc, adId);
    },
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    enabled: !!adId,
    retry: (count, err) => !(err instanceof P2PAdNotFoundError) && count < 2,
  });
}

export { P2PAdNotFoundError };

export function useP2PReferencePrice(asset: string, fiat: string) {
  return useQuery({
    queryKey: ['p2p', 'reference-price', asset, fiat],
    queryFn: () => getP2PRepository().getReferencePrice(asset, fiat),
    enabled: !!asset && !!fiat,
    staleTime: 60_000,
  });
}

export function useMyP2PAds() {
  return useQuery({
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
  return useQuery({
    queryKey: [...P2P_ORDERS_KEY, status],
    queryFn: () => getP2PRepository().getMyOrders(status),
    staleTime: 15_000,
  });
}

export function useP2POrder(orderId: string, seedOrder?: P2POrder) {
  const qc = useQueryClient();
  const wsConnected = useWsMetricsStore((s) => s.streamPhase === 'live');

  return useQuery({
    queryKey: P2P_ORDER_KEY(orderId),
    queryFn: async () => {
      const order = await getP2PRepository().getOrder(orderId);
      if (!order?.id) throw new P2POrderNotFoundError(orderId);
      return order;
    },
    initialData: () => {
      if (seedOrder?.id === orderId) return seedOrder;
      return findOrderInQueryCache(qc, orderId);
    },
    enabled: !!orderId,
    staleTime: 5_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
    refetchInterval: (q) => {
      const st = q.state.data?.status;
      if (isTerminalOrderStatus(st) || st === 'disputed') return false;
      return wsConnected ? 60_000 : 5_000;
    },
    retry: (count, err) => !(err instanceof P2POrderNotFoundError) && count < 2,
  });
}

export { P2POrderNotFoundError, P2P_ORDER_QUERY_KEY };

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

export function useP2PMessages(orderId: string, enabled = true) {
  const storeMessages = useP2PStore((s) => s.messagesByOrder[orderId]);
  const setMessages = useP2PStore((s) => s.setMessages);
  const wsConnected = useWsMetricsStore((s) => s.streamPhase === 'live');

  const q = useQuery({
    queryKey: P2P_MESSAGES_KEY(orderId),
    queryFn: () => getP2PRepository().getMessages(orderId),
    enabled: !!orderId && enabled,
    staleTime: 5_000,
    refetchInterval: () => {
      if (!enabled || !orderId) return false;
      return wsConnected ? 45_000 : 4_000;
    },
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
  return useQuery({
    queryKey: P2P_PAYMENT_METHODS_KEY,
    queryFn: () => getP2PRepository().getPlatformPaymentMethods(),
    staleTime: 300_000,
  });
}

export function useMyPaymentMethods() {
  return useQuery({
    queryKey: P2P_MY_PAYMENT_METHODS_KEY,
    queryFn: () => getP2PRepository().getMyPaymentMethods(true),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/** ADR-011 — payment method from list cache / navigation seed (no GET-by-ID). */
export function usePaymentMethod(methodId: string, seed?: P2PUserPaymentMethod) {
  const qc = useQueryClient();
  const listQ = useMyPaymentMethods();
  const cached = seed?.id === methodId ? seed : findPaymentMethodInCache(qc, methodId);
  const fromList = listQ.data?.find((m) => m.id === methodId);
  const method = fromList ?? cached;

  return {
    method,
    isLoading: listQ.isLoading && !method,
    isError: listQ.isError && !method,
    refetch: listQ.refetch,
  };
}

export { findPaymentMethodInCache };

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
  return useQuery({
    queryKey: P2P_MERCHANT_STATS_KEY,
    queryFn: () => getP2PRepository().getMerchantStats(),
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });
}

/** Merchant dashboard — stats + orders + my ads (website merchant-dashboard parity). */
export function useMerchantDashboard() {
  const statsQ = useMerchantStats();
  const ordersQ = useMyP2POrders();
  const adsQ = useMyP2PAds();
  return { statsQ, ordersQ, adsQ };
}

/** ADR-011 public merchant profile — advertiser ads list with cache seed. */
export function useMerchantProfileAds(advertiserId: string, seedAd?: P2PAd) {
  const qc = useQueryClient();
  return useQuery({
    queryKey: P2P_MERCHANT_PROFILE_KEY(advertiserId),
    queryFn: () => getP2PRepository().getAds({ advertiser_id: advertiserId, limit: 50, offset: 0 }),
    initialData: () => {
      if (seedAd?.user_id === advertiserId) return [seedAd];
      const cached = findMerchantSeedInCache(qc, advertiserId);
      return cached ? [cached] : undefined;
    },
    enabled: !!advertiserId,
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    refetchOnMount: 'always',
  });
}

export { findMerchantSeedInCache, merchantProfileFromAds };

export function useP2PDispute(disputeId: string) {
  return useQuery({
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
