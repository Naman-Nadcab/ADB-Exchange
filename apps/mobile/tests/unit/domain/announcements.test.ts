import { describe, it, expect } from '@jest/globals';
import {
  formatAnnouncementListDate,
  isAnnouncementNew,
  sanitizeAnnouncementHtml,
} from '@core/domain/announcements/announcements';
import {
  resolveAnnouncementNotificationRoute,
  resolveNotificationRoute,
} from '@core/domain/notifications/routing';
import type { UserNotification } from '@exchange/mobile-types';

describe('announcements domain', () => {
  it('marks pinned announcements as new', () => {
    expect(isAnnouncementNew({ is_pinned: true, published_at: '2020-01-01T00:00:00Z' })).toBe(true);
  });

  it('marks recent published announcements as new', () => {
    expect(
      isAnnouncementNew({ is_pinned: false, published_at: new Date().toISOString() }),
    ).toBe(true);
  });

  it('sanitizes script tags like website', () => {
    expect(sanitizeAnnouncementHtml('<p>Hi</p><script>alert(1)</script>')).not.toContain('<script');
  });

  it('formats list dates from published_at', () => {
    const label = formatAnnouncementListDate({
      published_at: '2026-07-01T00:00:00Z',
      created_at: '2026-06-01T00:00:00Z',
    });
    expect(label).toMatch(/2026/);
  });
});

describe('announcement notification routing', () => {
  const base = (over: Partial<UserNotification> = {}): UserNotification => ({
    id: 'n-1',
    type: 'system_announcement',
    title: 'Update',
    read: false,
    created_at: '2026-07-15T10:00:00Z',
    ...over,
  });

  it('routes to announcement detail when id is present', () => {
    expect(
      resolveAnnouncementNotificationRoute(
        base({ data: { announcement_id: 'ann-1' } }),
      ),
    ).toEqual({ kind: 'announcement', announcementId: 'ann-1' });
  });

  it('falls back to announcements hub without id', () => {
    expect(resolveNotificationRoute(base())).toEqual({ kind: 'announcements_hub' });
  });
});
