import { useP2PStore } from '@core/state/p2pStore';
import { appEventBus } from '@core/events/appEventBus';
import type { P2PMessage, P2POrder } from '@exchange/mobile-types';

export function handleP2POrderUpdate(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as { type?: string; data?: P2POrder };
  if (msg.type !== 'p2p_order_update' || !msg.data?.id) return;
  appEventBus.emit('p2p:orders:invalidate', msg.data);
}

export function handleP2POrderRoomMessage(message: unknown): void {
  if (!message || typeof message !== 'object') return;
  const msg = message as {
    type?: string;
    channel?: string;
    data?: Record<string, unknown>;
  };
  const channel = msg.channel ?? '';
  const orderId = channel.startsWith('p2p.order.') ? channel.slice('p2p.order.'.length) : '';
  if (!orderId) return;

  if (msg.type === 'message:new' && msg.data) {
    const payload = msg.data as unknown as P2PMessage;
    useP2PStore.getState().appendMessage(orderId, {
      id: String(payload.id),
      orderId,
      senderId: String(payload.senderId),
      senderUsername: payload.senderUsername ?? null,
      message: String(payload.message ?? ''),
      createdAt: String(payload.createdAt ?? new Date().toISOString()),
    });
    return;
  }

  if (msg.type === 'message:read') {
    return;
  }

  if (msg.type === 'typing' && msg.data) {
    const userId = String((msg.data as { userId?: string }).userId ?? '');
    useP2PStore.getState().setTyping(orderId, userId || null);
    return;
  }

  if (msg.type === 'order:updated' || msg.type === 'order:status_changed') {
    appEventBus.emit('p2p:order:invalidate', { orderId, data: msg.data });
  }
}
