'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAdminAuthStore } from '@/store/auth';
import { adminFetch } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { AdminPageFrame } from '@/components/admin-shell/AdminPageFrame';
import { ArrowLeft, CheckCircle2, AlertTriangle, KeyRound, Bell, Loader2, RefreshCw } from 'lucide-react';

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
}

const inputCls =
  'w-full rounded-lg border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text focus:outline-none focus:ring-1 focus:ring-admin-accent/50';
const labelCls = 'block text-xs font-medium text-admin-muted mb-1';

function SaveState({ m }: { m: { isSuccess: boolean; isError: boolean; isPending: boolean } }) {
  if (m.isPending) return <span className="flex items-center gap-1 text-xs text-admin-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</span>;
  if (m.isSuccess) return <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Saved &amp; activated</span>;
  if (m.isError) return <span className="flex items-center gap-1 text-xs text-red-400"><AlertTriangle className="h-3.5 w-3.5" /> Failed to save</span>;
  return null;
}

export default function AuthNotificationsSettingsPage() {
  const token = useAdminAuthStore((s) => s.accessToken);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'settings', 'auth-notifications', token],
    queryFn: () => adminFetch<{ settings: ApiSettingRow[] }>('/settings/api', { token }),
    enabled: !!token,
  });

  const settings = data?.data?.settings ?? [];
  const googleRow = settings.find((s) => s.category === 'social_login' && s.provider === 'google') ?? null;
  const vapidRow = settings.find((s) => s.category === 'web_push' && s.provider === 'vapid') ?? null;

  // ---- Google form state ----
  const [gClientId, setGClientId] = useState('');
  const [gClientSecret, setGClientSecret] = useState('');
  const [gCallback, setGCallback] = useState('');
  const [gActive, setGActive] = useState(false);

  // ---- VAPID form state ----
  const [vSubject, setVSubject] = useState('');
  const [vPublic, setVPublic] = useState('');
  const [vPrivate, setVPrivate] = useState('');
  const [vActive, setVActive] = useState(false);

  useEffect(() => {
    if (googleRow) {
      setGClientId(googleRow.api_key ?? '');
      setGCallback(googleRow.additional_config?.callback_url ?? '');
      setGActive(googleRow.is_active);
    }
  }, [googleRow]);

  useEffect(() => {
    if (vapidRow) {
      setVSubject(vapidRow.additional_config?.subject ?? '');
      setVPublic(vapidRow.api_key ?? '');
      setVActive(vapidRow.is_active);
    }
  }, [vapidRow]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'settings', 'auth-notifications'] });

  // Upsert via POST (create) or PUT (update keeps secrets when blank via COALESCE).
  const saveGoogle = useMutation({
    mutationFn: async () => {
      const additional_config = { callback_url: gCallback.trim() };
      if (googleRow) {
        await adminFetch('/settings/api/' + googleRow.id, {
          method: 'PUT',
          token,
          body: {
            api_key: gClientId.trim(),
            api_secret: gClientSecret.trim() || undefined, // blank → keep existing
            additional_config,
            is_active: gActive,
          },
        });
      } else {
        await adminFetch('/settings/api', {
          method: 'POST',
          token,
          body: {
            category: 'social_login',
            provider: 'google',
            name: 'Google',
            api_key: gClientId.trim(),
            api_secret: gClientSecret.trim(),
            additional_config,
            is_active: gActive,
            is_default: true,
          },
        });
      }
    },
    onSuccess: () => { setGClientSecret(''); invalidate(); },
  });

  const saveVapid = useMutation({
    mutationFn: async () => {
      const additional_config = { subject: vSubject.trim() || 'mailto:admin@example.com' };
      if (vapidRow) {
        await adminFetch('/settings/api/' + vapidRow.id, {
          method: 'PUT',
          token,
          body: {
            api_key: vPublic.trim(),
            api_secret: vPrivate.trim() || undefined, // blank → keep existing
            additional_config,
            is_active: vActive,
          },
        });
      } else {
        await adminFetch('/settings/api', {
          method: 'POST',
          token,
          body: {
            category: 'web_push',
            provider: 'vapid',
            name: 'Web Push (VAPID)',
            api_key: vPublic.trim(),
            api_secret: vPrivate.trim(),
            additional_config,
            is_active: vActive,
            is_default: true,
          },
        });
      }
    },
    onSuccess: () => { setVPrivate(''); invalidate(); },
  });

  const generateVapid = useMutation({
    mutationFn: () => adminFetch<{ publicKey: string; privateKey: string }>('/settings/web-push/generate-keys', { method: 'POST', token }),
    onSuccess: (res) => {
      if (res.data) {
        setVPublic(res.data.publicKey);
        setVPrivate(res.data.privateKey);
      }
    },
  });

  return (
    <AdminPageFrame
      title="Login & Notifications"
      description="Configure Google sign-in and Web Push (VAPID) credentials. Changes activate instantly — no backend restart needed."
      quickActions={
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      }
    >
      <Link
        href="/system/integrations"
        className="flex items-center justify-between rounded-xl border border-admin-border bg-admin-surface px-4 py-3 text-sm transition-colors hover:border-admin-accent/40"
      >
        <span className="text-admin-muted">
          This is a focused editor for Login &amp; Push. These settings share the same store as the{' '}
          <span className="font-medium text-admin-text">Integrations Center</span> — open it for all providers →
        </span>
        <KeyRound className="h-4 w-4 text-admin-muted" />
      </Link>

      {/* Google Sign-In */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Google Account Linking &amp; Sign-In
          </CardTitle>
          <Badge variant={googleRow?.is_active ? 'success' : 'default'}>
            {googleRow?.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-admin-muted">
            Used for &quot;Continue with Google&quot; and account linking. Get credentials from the
            Google Cloud Console (OAuth 2.0 Client ID). The system reads these live from the database.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={labelCls}>Client ID</label>
              <input className={inputCls} value={gClientId} onChange={(e) => setGClientId(e.target.value)} placeholder="xxxxxx.apps.googleusercontent.com" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Client Secret</label>
              <input
                type="password"
                className={inputCls}
                value={gClientSecret}
                onChange={(e) => setGClientSecret(e.target.value)}
                placeholder={googleRow?.has_secret ? 'Configured — leave blank to keep current' : 'GOCSPX-…'}
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Callback / Redirect URL</label>
              <input className={inputCls} value={gCallback} onChange={(e) => setGCallback(e.target.value)} placeholder="https://your-domain.com/auth/callback/google" />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input type="checkbox" checked={gActive} onChange={(e) => setGActive(e.target.checked)} className="h-4 w-4 rounded border-admin-border bg-admin-surface" />
            Enable Google sign-in / linking
          </label>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={() => saveGoogle.mutate()} disabled={saveGoogle.isPending || !gClientId.trim()}>
              Save &amp; activate
            </Button>
            <SaveState m={saveGoogle} />
          </div>
        </CardContent>
      </Card>

      {/* Web Push (VAPID) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" /> Web Push Notifications (VAPID)
          </CardTitle>
          <Badge variant={vapidRow?.is_active ? 'success' : 'default'}>
            {vapidRow?.is_active ? 'Active' : 'Inactive'}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-admin-muted">
            Powers browser push notifications (events, account alerts). No third-party account needed —
            generate a VAPID keypair below and save. The public key is served to browsers; keep the private key secret.
          </p>
          <div className="grid gap-4">
            <div>
              <label className={labelCls}>Subject (contact mailto: or URL)</label>
              <input className={inputCls} value={vSubject} onChange={(e) => setVSubject(e.target.value)} placeholder="mailto:admin@your-domain.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls + ' mb-0'}>Public Key</label>
                <Button variant="ghost" size="sm" onClick={() => generateVapid.mutate()} disabled={generateVapid.isPending} title="Generate a new VAPID keypair">
                  {generateVapid.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                  <span className="ml-1">Generate keypair</span>
                </Button>
              </div>
              <input className={inputCls + ' font-mono text-xs'} value={vPublic} onChange={(e) => setVPublic(e.target.value)} placeholder="B…" />
            </div>
            <div>
              <label className={labelCls}>Private Key</label>
              <input
                type="password"
                className={inputCls + ' font-mono text-xs'}
                value={vPrivate}
                onChange={(e) => setVPrivate(e.target.value)}
                placeholder={vapidRow?.has_secret ? 'Configured — leave blank to keep current' : 'Private key'}
              />
            </div>
          </div>
          {generateVapid.isSuccess && vPrivate && (
            <p className="text-xs text-amber-400">
              New keypair generated. Click &quot;Save &amp; activate&quot; to apply. Note: rotating keys invalidates existing subscriptions — users will re-subscribe automatically.
            </p>
          )}
          <label className="flex items-center gap-2 text-sm text-admin-text">
            <input type="checkbox" checked={vActive} onChange={(e) => setVActive(e.target.checked)} className="h-4 w-4 rounded border-admin-border bg-admin-surface" />
            Enable Web Push notifications
          </label>
          <div className="flex items-center gap-3 pt-1">
            <Button onClick={() => saveVapid.mutate()} disabled={saveVapid.isPending || !vPublic.trim() || (!vapidRow?.has_secret && !vPrivate.trim())}>
              Save &amp; activate
            </Button>
            <SaveState m={saveVapid} />
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-xs text-admin-muted">Loading current configuration…</p>}
    </AdminPageFrame>
  );
}
