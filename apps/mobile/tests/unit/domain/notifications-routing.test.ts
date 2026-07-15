import type { UserNotification } from '@exchange/mobile-types';
import { resolveP2PNotificationRoute, countUnreadNotifications } from '@core/domain/notifications/routing';

describe('notification routing domain', () => {
  const base = (over: Partial<UserNotification> = {}): UserNotification => ({
    id: 'n-1',
    type: 'system_announcement',
    title: 'Hello',
    read: false,
    created_at: '2026-07-15T10:00:00Z',
    ...over,
  });

  it('routes p2p notifications with order id in data', () => {
    const route = resolveP2PNotificationRoute(
      base({ type: 'p2p_payment_received', data: { order_id: 'ord-123' } }),
    );
    expect(route).toEqual({ kind: 'p2p_order', orderId: 'ord-123' });
  });

  it('returns null without order id', () => {
    expect(resolveP2PNotificationRoute(base({ type: 'p2p_completed' }))).toBeNull();
  });

  it('counts unread notifications', () => {
    expect(countUnreadNotifications([base(), base({ id: 'n-2', read: true })])).toBe(1);
  });
});
