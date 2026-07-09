'use client';

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { formatSaveError } from '@/lib/admin-save-feedback';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Search, CheckCircle2, AlertTriangle, Loader2, Plug, Activity, KeyRound,
} from 'lucide-react';

interface ApiSettingRow {
  id: string;
  category: string;
  provider: string;
  name: string;
  api_key: string | null;
  api_secret: string | null;
  has_secret?: boolean;
  api_url: string | null;
  additional_config: Record<string, string> | null;
  is_active: boolean;
  is_default: boolean;
  priority?: number | null;
  environment?: string | null;
  health_status?: string | null;
  last_check_at?: string | null;
  last_success_at?: string | null;
  last_failure_at?: string | null;
  last_error?: string | null;
  last_latency_ms?: number | null;
  failover_provider_id?: string | null;
}

/** Group taxonomy → the api_settings categories that belong to each group. */
const GROUPS: { key: string; label: string; categories: string[] }[] = [
  { key: 'auth', label: 'Authentication', categories: ['social_login'] },
  { key: 'comms', label: 'Communication', categories: ['email', 'sms', 'push', 'web_push', 'alert'] },
  { key: 'compliance', label: 'Compliance', categories: ['kyc', 'aml', 'travel_rule'] },
  { key: 'blockchain', label: 'Blockchain', categories: ['rpc', 'custody'] },
  { key: 'storage', label: 'Storage', categories: ['storage'] },
  { key: 'security', label: 'Security', categories: ['captcha', 'recaptcha'] },
  { key: 'trading', label: 'Market Data', categories: ['market_data', 'chart'] },
  { key: 'analytics', label: 'Analytics & Monitoring', categories: ['analytics', 'monitoring'] },
  { key: 'ai', label: 'AI', categories: ['ai'] },
  { key: 'support', label: 'Support', categories: ['support'] },
];

const CATEGORY_LABEL: Record<string, string> = {
  social_login: 'OAuth', email: 'Email', sms: 'SMS', push: 'Push (FCM)', web_push: 'Web Push', alert: 'Alerts',
  kyc: 'KYC', aml: 'AML', travel_rule: 'Travel Rule', rpc: 'RPC', custody: 'Custody',
  storage: 'Storage', captcha: 'CAPTCHA', recaptcha: 'reCAPTCHA', market_data: 'Market Data',
  chart: 'Chart Data', analytics: 'Analytics', monitoring: 'Monitoring', ai: 'AI', support: 'Support',
};

const inputCls = 'w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50';
const labelCls = 'block text-xs font-medium text-admin-muted mb-1';

function healthVariant(h?: string | null): 'success' | 'danger' | 'warning' | 'default' {
  if (h === 'healthy') return 'success';
  if (h === 'down') return 'danger';
  if (h === 'degraded') return 'warning';
  return 'default';
}

function ProviderCard({ row, token, onChanged, allRows }: { row: ApiSettingRow; token: string | null; onChanged: () => void; allRows: ApiSettingRow[] }) {
  const toast = useAdminToast();
  const [apiKey, setApiKey] = useState(row.api_key ?? '');
  const [apiSecret, setApiSecret] = useState('');
  const [apiUrl, setApiUrl] = useState(row.api_url ?? '');
  const [priority, setPriority] = useState(String(row.priority ?? 100));
  const [environment, setEnvironment] = useState(row.environment ?? 'production');
  const [isActive, setIsActive] = useState(row.is_active);
  const [failoverId, setFailoverId] = useState(row.failover_provider_id ?? '');
  const [extraConfig, setExtraConfig] = useState(() => JSON.stringify(row.additional_config ?? {}, null, 2));
  const [showHealth, setShowHealth] = useState(false);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [extraError, setExtraError] = useState<string | null>(null);

  const failoverOptions = allRows.filter((r) => r.category === row.category && r.id !== row.id);

  const save = useMutation({
    mutationFn: () => {
      let parsedExtra: Record<string, string> | undefined;
      try {
        parsedExtra = extraConfig.trim() ? JSON.parse(extraConfig) as Record<string, string> : {};
        setExtraError(null);
      } catch {
        setExtraError('Invalid JSON in additional config');
        throw new Error('Invalid additional_config JSON');
      }
      return adminFetch('/settings/api/' + row.id, {
        method: 'PUT', token,
        body: {
          api_key: apiKey.trim() || undefined,
          api_secret: apiSecret.trim() || undefined,
          api_url: apiUrl.trim() || undefined,
          priority: Number(priority) || 100,
          environment,
          is_active: isActive,
          additional_config: parsedExtra,
          failover_provider_id: failoverId || null,
        },
      });
    },
    onSuccess: () => { setApiSecret(''); onChanged(); toast.success('Provider settings saved.'); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to save provider settings.')),
  });

  const rotate = useMutation({
    mutationFn: () => {
      if (!apiSecret.trim()) throw new Error('Enter new secret to rotate');
      return adminFetch('/settings/api/' + row.id + '/rotate', { method: 'POST', token, body: { api_secret: apiSecret.trim() } });
    },
    onSuccess: () => { setApiSecret(''); onChanged(); toast.success('API secret rotated.'); },
    onError: (e) => toast.error(formatSaveError(e, 'Failed to rotate API secret.')),
  });

  const healthQuery = useQuery({
    queryKey: ['admin', 'integration-health', row.id, token],
    queryFn: () => adminFetch<{ checks: Array<{ success: boolean; latency_ms: number; message: string; created_at: string }> }>(
      '/settings/api/' + row.id + '/health', { token },
    ),
    enabled: !!token && showHealth,
  });

  const test = useMutation({
    mutationFn: () => adminFetch<{ success: boolean; message: string; latencyMs: number }>('/settings/api/' + row.id + '/test', { method: 'POST', token }),
    onSuccess: (res) => {
      const d = res.data as { success?: boolean; message?: string } | undefined;
      setTestMsg({ ok: Boolean(d?.success), text: d?.message ?? 'Tested' });
      onChanged();
      toast.success(d?.message ?? 'Connection test completed.');
    },
    onError: (e) => {
      setTestMsg({ ok: false, text: 'Test request failed' });
      toast.error(formatSaveError(e, 'Test request failed'));
    },
  });

  return (
    <div className="rounded-lg border border-admin-border bg-admin-card p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-admin-text">{row.name}</h3>
            {row.is_default && <Badge variant="info">Default</Badge>}
          </div>
          <p className="mt-0.5 text-xs text-admin-muted">{CATEGORY_LABEL[row.category] ?? row.category} · {row.provider}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={isActive ? 'success' : 'default'}>{isActive ? 'Enabled' : 'Disabled'}</Badge>
          <Badge variant={healthVariant(row.health_status)}>
            {row.health_status && row.health_status !== 'unknown' ? row.health_status : 'untested'}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelCls}>API Key / Client ID</label>
          <input className={inputCls} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="—" />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Secret</label>
          <input type="password" className={inputCls} value={apiSecret} onChange={(e) => setApiSecret(e.target.value)}
            placeholder={row.has_secret ? 'Encrypted — leave blank to keep current' : 'Not set'} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Base / Endpoint URL</label>
          <input className={inputCls} value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className={labelCls}>Priority</label>
          <input className={inputCls} value={priority} onChange={(e) => setPriority(e.target.value)} inputMode="numeric" />
        </div>
        <div>
          <label className={labelCls}>Environment</label>
          <select className={inputCls} value={environment} onChange={(e) => setEnvironment(e.target.value)}>
            <option value="production">Production</option>
            <option value="sandbox">Sandbox</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Fallback provider</label>
          <select className={inputCls} value={failoverId} onChange={(e) => setFailoverId(e.target.value)}>
            <option value="">None</option>
            {failoverOptions.map((o) => (
              <option key={o.id} value={o.id}>{o.name} ({o.provider})</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className={labelCls}>Additional config (JSON) — host, port, bucket, callback_url, DSN…</label>
          <textarea className={inputCls + ' font-mono text-xs min-h-[80px]'} value={extraConfig} onChange={(e) => setExtraConfig(e.target.value)} />
          {extraError && <p className="mt-1 text-xs text-red-400">{extraError}</p>}
        </div>
      </div>

      {(row.last_success_at || row.last_failure_at) && (
        <p className="mt-2 text-[11px] text-admin-muted">
          {row.last_success_at && <span className="text-emerald-400/80">Last OK: {new Date(row.last_success_at).toLocaleString()} </span>}
          {row.last_failure_at && <span className="text-red-400/80">Last fail: {new Date(row.last_failure_at).toLocaleString()}</span>}
          {row.last_latency_ms != null && <span> · {row.last_latency_ms}ms</span>}
        </p>
      )}

      {row.last_error && !row.health_status?.includes('healthy') && (
        <p className="mt-2 text-xs text-red-400 truncate" title={row.last_error}>Last error: {row.last_error}</p>
      )}
      {testMsg && (
        <p className={`mt-2 flex items-center gap-1 text-xs ${testMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
          {testMsg.ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />} {testMsg.text}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="mr-auto flex items-center gap-2 text-xs text-admin-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-admin-border bg-admin-surface" />
          Enabled
        </label>
        <Button variant="ghost" size="sm" onClick={() => test.mutate()} disabled={test.isPending}>
          {test.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Activity className="h-3.5 w-3.5" />}
          <span className="ml-1">Test</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setShowHealth((v) => !v)}>
          History
        </Button>
        {apiSecret.trim() && (
          <Button variant="ghost" size="sm" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
            Rotate secret
          </Button>
        )}
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          <span className={save.isPending ? 'ml-1' : ''}>Save &amp; activate</span>
        </Button>
        {save.isSuccess && <span className="text-xs text-emerald-400">Saved</span>}
        {save.isError && <span className="text-xs text-red-400">Save failed</span>}
      </div>
      {showHealth && (
        <div className="mt-3 rounded border border-admin-border bg-admin-surface/50 p-2 text-xs">
          {healthQuery.isLoading ? 'Loading health history…' : (
            (healthQuery.data?.data?.checks ?? []).length === 0
              ? <span className="text-admin-muted">No tests yet — click Test.</span>
              : (healthQuery.data?.data?.checks ?? []).map((c, i) => (
                <div key={i} className={c.success ? 'text-emerald-400' : 'text-red-400'}>
                  {new Date(c.created_at).toLocaleString()} — {c.message} ({c.latency_ms}ms)
                </div>
              ))
          )}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-card px-3 py-2">
      <div className={`text-lg font-semibold ${tone ?? 'text-admin-text'}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-admin-muted">{label}</div>
    </div>
  );
}

export default function IntegrationsCenterPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();
  const [activeGroup, setActiveGroup] = useState('all');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['admin', 'integrations-center', token],
    queryFn: () => adminFetch<{ settings: ApiSettingRow[] }>('/settings/api', { token }),
    enabled: !!token,
  });

  const all = useMemo(() => data?.data?.settings ?? [], [data]);
  const onChanged = () => queryClient.invalidateQueries({ queryKey: ['admin', 'integrations-center'] });

  const filtered = useMemo(() => {
    const groupCats = activeGroup === 'all' ? null : GROUPS.find((g) => g.key === activeGroup)?.categories ?? [];
    const q = search.trim().toLowerCase();
    return all.filter((r) => {
      if (groupCats && !groupCats.includes(r.category)) return false;
      if (statusFilter === 'active' && !r.is_active) return false;
      if (statusFilter === 'inactive' && r.is_active) return false;
      if (q && !(`${r.name} ${r.provider} ${r.category}`.toLowerCase().includes(q))) return false;
      return true;
    });
  }, [all, activeGroup, search, statusFilter]);

  const activeCount = all.filter((r) => r.is_active).length;
  const downCount = all.filter((r) => r.health_status === 'down').length;

  return (
    <AdminPageFrame
      title="Integrations Center"
      description="Single source of truth for every external provider. Credentials are encrypted at rest and activate instantly — no redeploy."
      error={isError ? 'Failed to load integrations.' : undefined}
      onRetry={isError ? () => void refetch() : undefined}
      metrics={
        <>
          <Metric label="Providers" value={all.length} />
          <Metric label="Enabled" value={activeCount} tone={activeCount > 0 ? 'text-emerald-400' : undefined} />
          <Metric label="Unhealthy" value={downCount} tone={downCount > 0 ? 'text-red-400' : undefined} />
        </>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-muted" />
          <input className={inputCls + ' pl-9'} placeholder="Search providers…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-md border px-2.5 py-1.5 text-xs capitalize ${statusFilter === s ? 'border-admin-accent bg-admin-accent/10 text-admin-text' : 'border-admin-border text-admin-muted hover:text-admin-text'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Category navigation */}
        <nav className="flex flex-row flex-wrap gap-1.5 lg:w-52 lg:flex-col lg:flex-nowrap">
          <button type="button" onClick={() => setActiveGroup('all')}
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${activeGroup === 'all' ? 'bg-admin-accent/10 text-admin-text' : 'text-admin-muted hover:bg-admin-surface hover:text-admin-text'}`}>
            <Plug className="h-4 w-4" /> All providers
          </button>
          {GROUPS.map((g) => {
            const count = all.filter((r) => g.categories.includes(r.category)).length;
            if (count === 0) return null;
            return (
              <button key={g.key} type="button" onClick={() => setActiveGroup(g.key)}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${activeGroup === g.key ? 'bg-admin-accent/10 text-admin-text' : 'text-admin-muted hover:bg-admin-surface hover:text-admin-text'}`}>
                <span>{g.label}</span>
                <span className="text-xs text-admin-muted">{count}</span>
              </button>
            );
          })}
        </nav>

        {/* Provider grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="flex items-center gap-2 p-8 text-sm text-admin-muted"><Loader2 className="h-4 w-4 animate-spin" /> Loading providers…</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-admin-border p-10 text-center text-sm text-admin-muted">
              <KeyRound className="mx-auto mb-2 h-5 w-5" />
              No providers match your filters.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((row) => (
                <ProviderCard key={row.id} row={row} token={token} onChanged={onChanged} allRows={all} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminPageFrame>
  );
}
