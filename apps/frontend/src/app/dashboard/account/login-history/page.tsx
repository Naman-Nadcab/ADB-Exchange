'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Activity, Monitor, Globe, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

interface ActivityRow {
  activity_type: string;
  activity_details: Record<string, unknown> | string | null;
  ip_address: string | null;
  created_at: string;
}

function formatDate(date?: string | null, locale?: string) {
  if (!date) return '—';
  return new Date(date).toLocaleString(locale || undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function humanizeType(type: string): string {
  return type
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LoginHistoryPage() {
  const t = useTranslations('account.loginHistoryPage');
  const { fromApi } = useApiErrorMessage();
  const { accessToken, _hasHydrated } = useAuthStore();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!_hasHydrated || !accessToken) return;
      try {
        const res = await fetch(`${getApiBaseUrl()}/api/v1/user/activity?limit=100`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const json = await res.json();
        if (json.success) {
          setRows(Array.isArray(json.data) ? json.data : []);
        } else {
          setError(fromApi(json.error ?? json, 'generic.unknown'));
        }
      } catch {
        setError(t('loadFailed'));
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [accessToken, _hasHydrated, fromApi, t]);

  return (
    <div className="min-h-full bg-background">
      <div>
        <Link
          href="/dashboard/account"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" /> {t('backToAccount')}
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="w-11 h-11 bg-accent rounded-xl flex items-center justify-center">
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{t('subtitle')}</p>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" /> {t('loading')}
            </div>
          ) : error ? (
            <div className="py-16 text-center text-sell">{error}</div>
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">{t('noActivity')}</div>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row, idx) => (
                <div key={idx} className="flex items-center justify-between p-4 hover:bg-accent/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-accent rounded-lg flex items-center justify-center flex-shrink-0">
                      <Monitor className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{humanizeType(row.activity_type)}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                        <Globe className="w-3 h-3" /> {row.ip_address || t('unknownIp')}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground whitespace-nowrap ml-4">
                    {formatDate(row.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
