'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Bell, Download, FileText, Send, Shield, ChevronRight, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { ORDERS_HREF, walletPath, ROUTES } from '@/lib/routes';

/** Normalized notification for UI (API may use notification_type / is_read). */
export interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  created_at: string;
}

interface NotificationCenterProps {
  accessToken?: string | null;
  className?: string;
}

type NotificationsApiData =
  | Notification[]
  | {
      notifications?: Record<string, unknown>[];
      unreadCount?: number;
    };

function normalizeRow(row: Record<string, unknown>): Notification {
  const id = String(row.id ?? '');
  const title = String(row.title ?? '');
  const message = String(row.message ?? '');
  const type = String(row.type ?? row.notification_type ?? 'system_announcement');
  const read = Boolean(row.read ?? row.is_read);
  const created_at = String(row.created_at ?? '');
  return { id, title, message, type, read, created_at };
}

function mapTypeToRoute(type: string): string {
  const t = type.toLowerCase();
  if (t.includes('deposit')) return walletPath.depositCrypto;
  if (t.includes('order') || t.includes('trade')) return `${ORDERS_HREF}/spot`;
  if (t.includes('withdraw')) return walletPath.withdrawCrypto;
  if (t.includes('security')) return '/dashboard/security';
  return ROUTES.dashboard.announcements;
}

function getConfig(type: string, labelFor: (key: 'deposit' | 'order' | 'withdrawal' | 'security') => string) {
  const key = type.toLowerCase().replace(/\s+/g, '_');
  if (key.includes('deposit')) return { icon: Download, label: labelFor('deposit') };
  if (key.includes('order') || key.includes('trade')) return { icon: FileText, label: labelFor('order') };
  if (key.includes('withdraw')) return { icon: Send, label: labelFor('withdrawal') };
  if (key.includes('security')) return { icon: Shield, label: labelFor('security') };
  return { icon: Bell, label: type.replace(/_/g, ' ') };
}

export function NotificationCenter({ accessToken, className = '' }: NotificationCenterProps) {
  const tPanel = useTranslations('common.notificationPanel');
  const tc = useTranslations('common');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    if (!accessToken) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }
    setLoading(true);
    const res = await api.get<NotificationsApiData>('/api/v1/user/notifications?limit=20', {
      notifyOnError: false,
    });
    setLoading(false);
    if (!res.success || res.data == null) {
      return;
    }
    const d = res.data;
    if (Array.isArray(d)) {
      const list = d.map((row) => normalizeRow(row as unknown as Record<string, unknown>));
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.read).length);
      return;
    }
    const raw = d.notifications ?? [];
    const list = raw.map((row) => normalizeRow(row as unknown as Record<string, unknown>));
    setNotifications(list);
    setUnreadCount(
      typeof d.unreadCount === 'number' ? d.unreadCount : list.filter((n) => !n.read).length
    );
  }, [accessToken]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  useEffect(() => {
    if (open && accessToken) {
      void loadNotifications();
    }
  }, [open, accessToken, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const markOneRead = async (id: string) => {
    const res = await api.patch(`/api/v1/user/notifications/${encodeURIComponent(id)}/read`, undefined, {
      notifyOnError: true,
    });
    if (res.success) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    setMarkingAll(true);
    const res = await api.post('/api/v1/user/notifications/read-all', undefined, { notifyOnError: true });
    setMarkingAll(false);
    if (res.success) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return tPanel('relativeJustNow');
    if (diffMins < 60) return tPanel('relativeMinutesAgo', { count: diffMins });
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return tPanel('relativeHoursAgo', { count: diffHours });
    return d.toLocaleDateString();
  };

  const handleRowClick = async (n: Notification) => {
    const href = mapTypeToRoute(n.type);
    if (!n.read) {
      await markOneRead(n.id);
    }
    setOpen(false);
    router.push(href);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-150"
        aria-label={tPanel('title')}
        aria-expanded={open}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-semibold text-destructive-foreground bg-destructive rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 bg-popover dark:bg-card border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">{tPanel('title')}</p>
            <div className="flex items-center gap-2 shrink-0">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  disabled={markingAll}
                  className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
                >
                  {markingAll ? tPanel('markingRead') : tPanel('markAllRead')}
                </button>
              )}
              <Link
                href={ROUTES.dashboard.announcements}
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline flex items-center gap-0.5"
              >
                {tPanel('viewAll')} <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="p-6 flex flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                {tc('states.loading')}
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">{tPanel('empty')}</div>
            ) : (
              notifications.slice(0, 10).map((n) => {
                const config = getConfig(n.type, (k) => tPanel(k));
                const Icon = config.icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => void handleRowClick(n)}
                    className={`flex gap-3 p-4 border-b border-border last:border-0 hover:bg-muted/50 transition-colors text-left w-full ${
                      !n.read ? 'bg-primary/5 dark:bg-primary/10' : ''
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{formatTime(n.created_at)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
