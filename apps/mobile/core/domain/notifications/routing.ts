/** Notification deep-link resolution — backend type + data only. */

import type { UserNotification } from '@exchange/mobile-types';

export type P2PNotificationRoute = {
  kind: 'p2p_order';
  orderId: string;
};

export type AnnouncementNotificationRoute = {
  kind: 'announcement';
  announcementId: string;
};

export type NotificationRoute = P2PNotificationRoute | AnnouncementNotificationRoute | { kind: 'announcements_hub' } | { kind: 'none' };

function readOrderId(data?: Record<string, unknown>): string | null {
  if (!data) return null;
  const raw = data.order_id ?? data.orderId ?? data.p2p_order_id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export function resolveP2PNotificationRoute(notification: UserNotification): P2PNotificationRoute | null {
  const type = notification.type.toLowerCase();
  if (!type.includes('p2p')) return null;
  const orderId = readOrderId(notification.data);
  if (!orderId) return null;
  return { kind: 'p2p_order', orderId };
}

function readAnnouncementId(data?: Record<string, unknown>): string | null {
  if (!data) return null;
  const raw = data.announcement_id ?? data.announcementId ?? data.id;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  return null;
}

export function resolveAnnouncementNotificationRoute(
  notification: UserNotification,
): AnnouncementNotificationRoute | null {
  const type = notification.type.toLowerCase();
  if (!type.includes('announcement')) return null;
  const announcementId = readAnnouncementId(notification.data);
  if (!announcementId) return null;
  return { kind: 'announcement', announcementId };
}

export function resolveNotificationRoute(notification: UserNotification): NotificationRoute {
  const p2p = resolveP2PNotificationRoute(notification);
  if (p2p) return p2p;
  const announcement = resolveAnnouncementNotificationRoute(notification);
  if (announcement) return announcement;
  if (notification.type.toLowerCase().includes('announcement')) {
    return { kind: 'announcements_hub' };
  }
  return { kind: 'none' };
}

export function countUnreadNotifications(notifications: UserNotification[]): number {
  return notifications.filter((n) => !n.read).length;
}
