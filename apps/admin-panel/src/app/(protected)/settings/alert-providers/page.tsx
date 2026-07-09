'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  BellRing, CheckCircle2, AlertTriangle, Loader2, Activity, Send,
  MessageSquare, Mail, Webhook, Shield, ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface ApiSettingRow {
  id: string;
  category: string;
  provider: string;
  name: string;
  api_key: string | null;
  has_secret?: boolean;
  api_url: string | null;
  additional_config: Record<string, string> | null;
  is_active: boolean;
  is_default: boolean;
  health_status?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  last_latency_ms?: number | null;
}

const PROVIDER_HELP: Record<string, { icon: React.ElementType; hint: string; fields: string }> = {
  webhook: { icon: Webhook, hint: 'Generic JSON webhook (Slack-compatible payload)', fields: 'Webhook URL in Base URL field' },
  slack: { icon: MessageSquare, hint: 'Slack Incoming Webhook URL', fields: 'Paste Slack webhook URL in Base URL' },
  discord: { icon: MessageSquare, hint: 'Discord channel webhook URL', fields: 'Discord webhook URL in Base URL' },
  telegram: { icon: Send, hint: 'Telegram bot alerts', fields: 'Bot token in API Key; chat_id in additional_config JSON' },
  pagerduty: { icon: Shield, hint: 'PagerDuty Events API v2', fields: 'Routing key in Secret field' },
  email: { icon: Mail, hint: 'Email via configured SMTP (Integrations → Email)', fields: 'Recipient in additional_config: {"to":"ops@example.com"}' },
};

const inputCls = 'w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50';
const labelCls = 'block text-xs font-medium text-admin-muted mb-1';

function AlertProviderCard({ row, token, onChanged }: { row: ApiSettingRow; token: string | null; onChanged: () => void }) {
  const toast = useAdminToast();
  const help = PROVIDER_HELP[row.provider] ?? PROVIDER_HELP.webhook!;
  const Icon = help.icon;

  const [apiKey, setApiKey] = useState(row.api_key ?? '');
  const [apiSecret, setApiSecret] = useState('');
  const [apiUrl, setApiUrl] = useState(row.api_url ?? '');
  const [isActive, setIsActive] = useState(row.is_active);
  const [extraConfig, setExtraConfig] = useState(() => JSON.stringify(row.additional_config ?? {}, null, 2));
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const save = useMutation({
    mutationFn: () => {
      let parsedExtra: Record<string, string> = {};
      try {
        parsedExtra = extraConfig.trim() ? JSON.parse(extraConfig) as Record<string, string> : {};
      } catch {
        throw new Error('Invalid JSON in additional config');
      }
      return adminFetch('/settings/api/' + row.id, {
        method: 'PUT', token,
        body: {
          api_key: apiKey.trim() || undefined,
          api_secret: apiSecret.trim() || undefined,
          api_url: apiUrl.trim() || undefined,
          is_active: isActive,
          additional_config: parsedExtra,
        },
      });
    },
    onSuccess: () => { setApiSecret(''); onChanged(); toast.success(`${row.name} saved.`); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to save provider.')),
  });

  const testConn = useMutation({
    mutationFn: () => adminFetch<{ success?: boolean; message?: string }>('/settings/api/' + row.id + '/test', { method: 'POST', token }),
    onSuccess: (res) => {
      const d = res.data as { success?: boolean; message?: string } | undefined;
      setTestMsg({ ok: Boolean(d?.success), text: d?.message ?? 'Tested' });
      onChanged();
    },
    onError: (e) => {
      setTestMsg({ ok: false, text: formatSaveError(e, 'Connection test failed') });
    },
  });

  const sendTest = useMutation({
    mutationFn: () => adminFetch<{ success?: boolean; message?: string }>('/settings/api/' + row.id + '/send-test-alert', { method: 'POST', token }),
    onSuccess: (res) => {
      const d = res.data as { success?: boolean; message?: string } | undefined;
      toast.success(d?.message ?? 'Test alert sent.');
      onChanged();
    },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to send test alert.')),
  });

  return (
    <div className="rounded-xl border border-admin-border bg-admin-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-400">
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-admin-text">{row.name}</h3>
              {row.is_default && <Badge variant="info">Default</Badge>}
            </div>
            <p className="mt-0.5 text-xs text-admin-muted">{help.hint}</p>
            <p className="mt-1 text-[10px] text-zinc-500">{help.fields}</p>
          </div>
        </div>
        <Badge variant={isActive ? 'success' : 'default'}>{isActive ? 'Enabled' : 'Disabled'}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(row.provider === 'telegram' || row.provider === 'pagerduty') && (
          <div className="sm:col-span-2">
            <label className={labelCls}>{row.provider === 'telegram' ? 'Bot Token' : 'Routing Key / Client ID'}</label>
            <input type="password" className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={row.provider === 'telegram' ? '123456:ABC…' : '—'} />
          </div>
        )}
        {(row.provider === 'webhook' || row.provider === 'slack' || row.provider === 'discord') && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Webhook URL</label>
            <input className={inputCls} value={apiUrl || apiKey} onChange={(e) => { setApiUrl(e.target.value); setApiKey(e.target.value); }}
              placeholder="https://…" />
          </div>
        )}
        {row.provider === 'pagerduty' && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Routing Key (Secret)</label>
            <input type="password" className={inputCls} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
              placeholder={row.has_secret ? 'Encrypted — leave blank to keep' : 'Paste routing key'} />
          </div>
        )}
        {(row.provider === 'telegram' || row.provider === 'email') && (
          <div className="sm:col-span-2">
            <label className={labelCls}>Additional config (JSON)</label>
            <textarea className={inputCls + ' font-mono text-xs min-h-[60px]'} value={extraConfig} onChange={(e) => setExtraConfig(e.target.value)} />
          </div>
        )}
      </div>

      {testMsg && (
        <p className={cn('mt-2 flex items-center gap-1 text-xs', testMsg.ok ? 'text-emerald-400' : 'text-red-400')}>
          {testMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {testMsg.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-admin-border pt-3">
        <label className="mr-auto flex items-center gap-2 text-xs text-admin-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-admin-border" />
          Enabled
        </label>
        <Button variant="ghost" size="sm" onClick={() => testConn.mutate()} disabled={testConn.isPending}>
          {testConn.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          <span className="ml-1">Test connection</span>
        </Button>
        <Button variant="secondary" size="sm" onClick={() => sendTest.mutate()} disabled={sendTest.isPending}>
          {sendTest.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          <span className="ml-1">Send test alert</span>
        </Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span className={save.isPending ? 'ml-1' : ''}>Save</span>
        </Button>
      </div>
    </div>
  );
}

export default function AlertProvidersPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin', 'alert-providers', token],
    queryFn: () => adminFetch<{ settings: ApiSettingRow[] }>('/settings/api?category=alert', { token }),
    enabled: !!token,
  });

  const providers = useMemo(() => data?.data?.settings ?? [], [data]);
  const activeCount = providers.filter((p) => p.is_active).length;
  const onChanged = () => queryClient.invalidateQueries({ queryKey: ['admin', 'alert-providers'] });

  const pageError = isError ? (error instanceof Error ? error.message : 'Failed to load alert providers.') : null;

  return (
    <AdminPageFrame
      title="Alert Providers"
      description="Configure notification channels for infrastructure and ops alerts — no .env edits required."
      status={activeCount > 0 ? 'active' : 'warning'}
      error={pageError}
      onRetry={pageError ? () => void refetch() : undefined}
      quickActions={
        <Link href="/system/integrations">
          <Button variant="secondary" size="sm">
            <ExternalLink className="mr-1 h-4 w-4" />
            All integrations
          </Button>
        </Link>
      }
      metrics={
        <>
          <Metric label="Providers" value={providers.length} />
          <Metric label="Enabled" value={activeCount} tone={activeCount > 0 ? 'text-emerald-400' : 'text-amber-400'} />
          <Metric label="Types" value={new Set(providers.map((p) => p.provider)).size} />
        </>
      }
    >
      <div className="rounded-lg border border-indigo-500/20 bg-indigo-500/[0.04] px-4 py-3 text-sm text-indigo-200/90">
        <BellRing className="inline h-4 w-4 mr-1.5 -mt-0.5" />
        Active providers receive alerts from Monitoring, Alert Center, and ops events automatically.
        Use <strong>Send test alert</strong> to verify end-to-end delivery.
      </div>

      {isLoading ? (
        <div className="text-sm text-admin-muted py-8 text-center">Loading alert providers…</div>
      ) : providers.length === 0 ? (
        <div className="text-sm text-admin-muted py-8 text-center">No alert providers configured. Run database migration to seed defaults.</div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {providers.map((row) => (
            <AlertProviderCard key={row.id} row={row} token={token} onChanged={onChanged} />
          ))}
        </div>
      )}
    </AdminPageFrame>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-admin-border bg-admin-card px-3 py-2.5">
      <div className={cn('text-2xl font-bold tabular-nums', tone ?? 'text-admin-text')}>{value}</div>
      <div className="text-[10px] font-medium uppercase tracking-wider text-admin-muted">{label}</div>
    </div>
  );
}
