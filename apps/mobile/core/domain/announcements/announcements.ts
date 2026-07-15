import type { Announcement } from '@exchange/mobile-types';

const NEW_MS = 7 * 24 * 60 * 60 * 1000;

/** Mirrors website announcements list NEW badge rule. */
export function isAnnouncementNew(item: Pick<Announcement, 'is_pinned' | 'published_at'>): boolean {
  if (item.is_pinned) return true;
  if (!item.published_at) return false;
  return Date.now() - new Date(item.published_at).getTime() < NEW_MS;
}

/** Mirrors website detail page HTML sanitization. */
export function sanitizeAnnouncementHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '');
}

export function formatAnnouncementListDate(item: Pick<Announcement, 'published_at' | 'created_at'>): string {
  const raw = item.published_at ?? item.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleDateString();
}

export function formatAnnouncementDetailDate(item: Pick<Announcement, 'published_at' | 'created_at'>): string {
  const raw = item.published_at ?? item.created_at;
  if (!raw) return '—';
  return new Date(raw).toLocaleString();
}

export function isSystemAnnouncementNotification(type: string): boolean {
  return type.toLowerCase().includes('announcement');
}
