import { useQuery } from '@tanstack/react-query';
import { getUserRepository } from '@core/repositories/UserRepository';
import type { Announcement } from '@exchange/mobile-types';

export const ANNOUNCEMENTS_KEY = ['markets', 'announcements'] as const;

export function useAnnouncements(limit = 12) {
  return useQuery({
    queryKey: [...ANNOUNCEMENTS_KEY, limit],
    queryFn: async (): Promise<Announcement[]> => {
      const res = await getUserRepository().getAnnouncements(limit);
      return res.announcements ?? [];
    },
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function useAnnouncement(id: string) {
  return useQuery({
    queryKey: ['announcement', id],
    queryFn: async (): Promise<Announcement | null> => {
      const res = await getUserRepository().getAnnouncement(id);
      return res.announcement ?? null;
    },
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

export function partitionAnnouncements(items: Announcement[]) {
  const news = items.filter((a) => (a.type ?? '').toLowerCase().includes('news'));
  const announcements = items.filter((a) => !(a.type ?? '').toLowerCase().includes('news'));
  return { news, announcements };
}
