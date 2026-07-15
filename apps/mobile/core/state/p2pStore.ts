import { create } from 'zustand';
import type { P2PMessage, CreateP2PAdRequest } from '@exchange/mobile-types';

export type PostAdDraft = Partial<CreateP2PAdRequest>;

type P2PState = {
  postAdDraft: PostAdDraft;
  messagesByOrder: Record<string, P2PMessage[]>;
  seenMessageIds: Record<string, true>;
  typingUserIdByOrder: Record<string, string | null>;
  unreadOrderIds: Set<string>;
  notificationsUnread: number;
  blockedAdvertiserIds: string[];
  favoriteAdIds: string[];
  setPostAdDraft: (patch: PostAdDraft) => void;
  clearPostAdDraft: () => void;
  setMessages: (orderId: string, messages: P2PMessage[]) => void;
  appendMessage: (orderId: string, message: P2PMessage) => void;
  upsertMessage: (orderId: string, message: P2PMessage) => void;
  setTyping: (orderId: string, userId: string | null) => void;
  markOrderRead: (orderId: string) => void;
  setUnreadOrders: (ids: string[]) => void;
  setNotificationsUnread: (n: number) => void;
  addBlocked: (id: string) => void;
  removeBlocked: (id: string) => void;
  toggleFavorite: (adId: string) => void;
  clearOnLogout: () => void;
};

const initialDraft: PostAdDraft = {
  type: 'sell',
  currency: 'USDT',
  fiat: 'INR',
  pricing_type: 'fixed',
  payment_time_limit: 15,
  float_margin_percent: 0,
};

export const useP2PStore = create<P2PState>((set, get) => ({
  postAdDraft: { ...initialDraft },
  messagesByOrder: {},
  seenMessageIds: {},
  typingUserIdByOrder: {},
  unreadOrderIds: new Set(),
  notificationsUnread: 0,
  blockedAdvertiserIds: [],
  favoriteAdIds: [],

  setPostAdDraft: (patch) => set((s) => ({ postAdDraft: { ...s.postAdDraft, ...patch } })),
  clearPostAdDraft: () => set({ postAdDraft: { ...initialDraft } }),

  setMessages: (orderId, messages) =>
    set((s) => {
      const seen = { ...s.seenMessageIds };
      for (const m of messages) seen[m.id] = true;
      return { messagesByOrder: { ...s.messagesByOrder, [orderId]: messages }, seenMessageIds: seen };
    }),

  appendMessage: (orderId, message) => {
    const { seenMessageIds } = get();
    if (seenMessageIds[message.id]) return;
    set((s) => {
      const prev = s.messagesByOrder[orderId] ?? [];
      if (prev.some((m) => m.id === message.id)) return s;
      const seen = { ...s.seenMessageIds, [message.id]: true as const };
      return {
        messagesByOrder: { ...s.messagesByOrder, [orderId]: [...prev, message] },
        seenMessageIds: seen,
      };
    });
  },

  upsertMessage: (orderId, message) =>
    set((s) => {
      const prev = s.messagesByOrder[orderId] ?? [];
      const idx = prev.findIndex((m) => m.id === message.id || (m._clientId && m._clientId === message._clientId));
      const next = idx >= 0 ? prev.map((m, i) => (i === idx ? message : m)) : [...prev, message];
      const seen = { ...s.seenMessageIds, [message.id]: true as const };
      return { messagesByOrder: { ...s.messagesByOrder, [orderId]: next }, seenMessageIds: seen };
    }),

  setTyping: (orderId, userId) =>
    set((s) => ({ typingUserIdByOrder: { ...s.typingUserIdByOrder, [orderId]: userId } })),

  markOrderRead: (orderId) =>
    set((s) => {
      const next = new Set(s.unreadOrderIds);
      next.delete(orderId);
      return { unreadOrderIds: next };
    }),

  setUnreadOrders: (ids) => set({ unreadOrderIds: new Set(ids) }),
  setNotificationsUnread: (n) => set({ notificationsUnread: n }),

  addBlocked: (id) =>
    set((s) => ({
      blockedAdvertiserIds: s.blockedAdvertiserIds.includes(id) ? s.blockedAdvertiserIds : [...s.blockedAdvertiserIds, id],
    })),

  removeBlocked: (id) =>
    set((s) => ({ blockedAdvertiserIds: s.blockedAdvertiserIds.filter((x) => x !== id) })),

  toggleFavorite: (adId) =>
    set((s) => ({
      favoriteAdIds: s.favoriteAdIds.includes(adId)
        ? s.favoriteAdIds.filter((x) => x !== adId)
        : [...s.favoriteAdIds, adId],
    })),

  clearOnLogout: () =>
    set({
      postAdDraft: { ...initialDraft },
      messagesByOrder: {},
      seenMessageIds: {},
      typingUserIdByOrder: {},
      unreadOrderIds: new Set(),
      notificationsUnread: 0,
    }),
}));
