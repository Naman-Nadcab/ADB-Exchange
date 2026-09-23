'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Bell, Loader2 } from 'lucide-react';
import { getApiBaseUrl } from '@/lib/getApiUrl';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '')
    .replace(/javascript\s*:/gi, 'blocked:')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '');
}

interface Announcement {
  id: string;
  title: string;
  body: string | null;
  summary: string | null;
  type: string;
  is_pinned: boolean;
  published_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export default function AnnouncementDetailPage() {
  const params = useParams();
  const t = useTranslations('account.announcementDetailPage');
  const id = params?.id as string;
  const [item, setItem] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${getApiBaseUrl()}/api/v1/user/announcements/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && data?.data?.announcement) setItem(data.data.announcement);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="p-4 lg:p-8 max-w-3xl mx-auto">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Link href="/dashboard/announcements" className="mt-4 inline-flex items-center gap-2 text-primary hover:underline">
          <ArrowLeft className="w-4 h-4" /> {t('back')}
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <Link
        href="/dashboard/announcements"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> {t('back')}
      </Link>

      <article className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-6 lg:p-8 border-b border-border">
          <div className="flex items-start gap-3">
            <Bell className="w-5 h-5 text-warning mt-1 shrink-0" />
            <div>
              <h1 className="text-2xl font-semibold text-foreground">{item.title}</h1>
              <p className="text-sm text-muted-foreground mt-2">
                {item.published_at
                  ? new Date(item.published_at).toLocaleString()
                  : new Date(item.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        {item.body ? (
          <div
            className="p-6 lg:p-8 prose prose-sm dark:prose-invert max-w-none text-foreground/90"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(item.body) }}
          />
        ) : item.summary ? (
          <p className="p-6 lg:p-8 text-muted-foreground">{item.summary}</p>
        ) : null}
      </article>
    </div>
  );
}
