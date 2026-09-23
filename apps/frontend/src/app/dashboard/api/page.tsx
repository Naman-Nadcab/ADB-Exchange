'use client';

import { useTranslations } from 'next-intl';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { ChevronRight, X, Loader2, Eye, EyeOff, Copy, Check, Key, Trash2, Edit3, Shield, AlertCircle } from 'lucide-react';
import { SkeletonTableBody } from '@/components/ui/Skeleton';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { APIUsageStats } from '@/components/api/APIUsageStats';
import { APISecurityIndicators } from '@/components/api/APISecurityIndicators';
import { APIDocLinks } from '@/components/api/APIDocLinks';
import { getApiBaseUrl } from '@/lib/getApiUrl';
import { toast } from '@/components/ui/toaster';

interface ApiKey {
  id: string;
  name: string;
  keyType: 'system' | 'self';
  apiKeyUsage: 'transaction' | 'third_party';
  apiKey: string;
  apiSecret: string;
  permission: 'read_write' | 'read_only';
  ipRestriction: 'ip_only' | 'no_restriction';
  ipAddresses: string[];
  permissions: Record<string, boolean>;
  createdAt: string;
  expiresAt: string | null;
}

export default function ApiPage() {
  const t = useTranslations('account.apiManagementPage');
  const tc = useTranslations('account.common');
  const ts = useTranslations('security.common');
  const { fromApi, networkUnreachable } = useApiErrorMessage();
  const tn = useTranslations('common.notifications');
  const tt = useTranslations('account.toasts');
  const router = useRouter();
  const { accessToken } = useAuthStore();
  const apiUrl = getApiBaseUrl();

  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [visibleSecrets, setVisibleSecrets] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [revokeConfirmId, setRevokeConfirmId] = useState<string | null>(null);
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [editName, setEditName] = useState('');
  const [editPermission, setEditPermission] = useState<'read_write' | 'read_only'>('read_only');
  const [editIpRestriction, setEditIpRestriction] = useState<'ip_only' | 'no_restriction'>('no_restriction');
  const [editIpInput, setEditIpInput] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditModal = (key: ApiKey) => {
    setEditKey(key);
    setEditName(key.name || '');
    setEditPermission(key.permission === 'read_write' ? 'read_write' : 'read_only');
    setEditIpRestriction(key.ipAddresses.length > 0 ? 'ip_only' : 'no_restriction');
    setEditIpInput((key.ipAddresses || []).join(', '));
  };

  const handleUpdateKey = async () => {
    if (!editKey || !accessToken) return;
    const ipAddresses =
      editIpRestriction === 'ip_only'
        ? editIpInput.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    if (editIpRestriction === 'ip_only' && ipAddresses.length === 0) {
      toast({ title: tt('ipRequiredTitle'), description: tt('ipRequiredDesc'), variant: 'destructive' });
      return;
    }
    setSavingEdit(true);
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/api-keys/${editKey.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          name: editName.trim() || editKey.name,
          permission: editPermission,
          ipRestriction: editIpRestriction,
          ipAddresses,
        }),
      });
      const result = await response.json();
      if (result.success) {
        setApiKeys((prev) =>
          prev.map((k) =>
            k.id === editKey.id
              ? { ...k, name: editName.trim() || k.name, permission: editPermission, ipRestriction: editIpRestriction, ipAddresses }
              : k
          )
        );
        setEditKey(null);
        toast({ title: tt('apiKeyUpdatedTitle'), description: tt('apiKeyUpdatedDesc'), variant: 'success' });
      } else {
        toast({ title: tn('errorTitle'), description: result.error?.message ? fromApi(result.error) : tt('apiKeyUpdateFailed'), variant: 'destructive' });
      }
    } catch {
      toast({ title: tn('errorTitle'), description: tt('apiKeyUpdateFailed'), variant: 'destructive' });
    } finally {
      setSavingEdit(false);
    }
  };

  useEffect(() => {
    fetchApiKeys();
  }, [accessToken]);

  const fetchApiKeys = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/api-keys`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      const result = await response.json();

      if (result.success && result.data) {
        setApiKeys(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleSecretVisibility = (keyId: string) => {
    const newVisible = new Set(visibleSecrets);
    if (newVisible.has(keyId)) {
      newVisible.delete(keyId);
    } else {
      newVisible.add(keyId);
    }
    setVisibleSecrets(newVisible);
  };

  const copyToClipboard = async (text: string, keyId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(keyId);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const maskSecret = (secret: string) => {
    if (!secret) return '••••••••••••••••';
    return secret.slice(0, 4) + '••••••••' + secret.slice(-4);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getDaysToExpiration = (expiresAt: string | null) => {
    if (!expiresAt) return { text: 'Never', color: 'text-buy' };
    const days = Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return { text: 'Expired', color: 'text-sell' };
    if (days < 30) return { text: `${days} days`, color: 'text-warning' };
    return { text: `${days} days`, color: 'text-muted-foreground' };
  };

  const handleCreateKey = (type: 'system' | 'self') => {
    setShowTypeModal(false);
    router.push(`/dashboard/api/create?type=${type}`);
  };

  const handleDeleteKey = async (key: ApiKey) => {
    setDeletingId(key.id);
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/api-keys/${key.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.json();
      if (result.success) {
        setApiKeys((prev) => prev.filter((k) => k.id !== key.id));
        setRevokeConfirmId(null);
        toast({ title: tt('apiKeyDeletedTitle'), description: tt('apiKeyDeletedDesc'), variant: 'success' });
      } else {
        toast({ title: tn('errorTitle'), description: result.error?.message ? fromApi(result.error) : tt('apiKeyDeleteFailed'), variant: 'destructive' });
      }
    } catch (error) {
      console.error('Delete API key error:', error);
      toast({ title: tn('errorTitle'), description: tt('apiKeyDeleteFailed'), variant: 'destructive' });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-4 lg:p-8 bg-background min-h-full">
      <div className="max-w-7xl mx-auto">
        {/* Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 rounded-xl px-6 py-4 mb-8">
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-card/20 rounded-xl flex items-center justify-center">
                <span className="text-2xl">🚀</span>
              </div>
              <div>
                <h3 className="text-primary-foreground font-semibold">{t('bannerTitle')}</h3>
                <p className="text-primary-foreground/80 text-sm">{t('bannerSubtitle')}</p>
              </div>
            </div>
            <Link
              href={process.env.NEXT_PUBLIC_API_DOCS_URL || '/dashboard/announcements'}
              target={process.env.NEXT_PUBLIC_API_DOCS_URL ? '_blank' : undefined}
              rel={process.env.NEXT_PUBLIC_API_DOCS_URL ? 'noopener noreferrer' : undefined}
              className="px-4 py-2 bg-card/20 hover:bg-card/30 text-primary-foreground rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              aria-label={t('apiDocumentation')}
            >{t('documentationSection')}<ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
          </div>
          <button
            onClick={() => setShowTypeModal(true)}
            className="px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-semibold rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 flex items-center gap-2"
          >
            <Key className="w-5 h-5" />{t('createNewKey')}</button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <Key className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground inline-flex items-center gap-1">
                  API Keys <InfoTooltip content="Your API keys for trading and integrations. Keys without IP binding expire in 3 months." />
                </h3>
                <p className="text-xs text-muted-foreground">{apiKeys.length} / 20 keys</p>
              </div>
            </div>
            <div className="w-full bg-accent rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all"
                style={{ width: `${(apiKeys.length / 20) * 100}%` }}
              ></div>
            </div>
          </div>

          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-buy-light rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-buy" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('securityCardTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('ipWhitelistRecommended')}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{t('keysExpireNote')}</p>
          </div>

          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t('communityTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('joinTelegram')}</p>
              </div>
            </div>
            <div className="flex gap-2 mt-2">
              <a
                href={process.env.NEXT_PUBLIC_TELEGRAM_EN_URL || 'https://t.me/metherium'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/85"
              >{t('englishGroup')}</a>
              <a
                href={process.env.NEXT_PUBLIC_TELEGRAM_ZH_URL || process.env.NEXT_PUBLIC_TELEGRAM_EN_URL || 'https://t.me/metherium'}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:text-primary/85"
              >{t('chineseGroup')}</a>
            </div>
          </div>
        </div>

        {/* API Usage Analytics */}
        <div className="mb-8">
          <APIUsageStats
            requestsToday={0}
            errors={0}
            rateLimitUsage={0}
            rateLimitMax={100}
            loading={loading}
          />
          {!loading && apiKeys.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground text-center">{t('statsRealtimeNote')}</p>
          )}
        </div>

        {/* API Security Indicators & Doc Links */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('securityCardTitle')}</p>
            <APISecurityIndicators
              ipWhitelistCount={apiKeys.filter((k) => k.ipAddresses?.length > 0).length}
              readOnlyCount={apiKeys.filter((k) => k.permission === 'read_only').length}
              withdrawalDisabledCount={apiKeys.filter((k) => k.permission === 'read_only').length}
              totalKeys={apiKeys.length}
            />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{t('documentationSection')}</p>
            <APIDocLinks />
          </div>
        </div>

        {/* API Key Records */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <h2 className="text-lg font-semibold text-foreground">{t('recordsTitle')}</h2>
            <p className="text-sm text-muted-foreground mt-1">{t('recordsSubtitle')}</p>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colName')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colType')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colApiKey')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colSecret')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colPermission')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colIpBound')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colCreated')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colExpires')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <SkeletonTableBody rows={4} columns={9} />
                </tbody>
              </table>
            </div>
          ) : apiKeys.length === 0 ? (
            <div className="py-20">
              {/* Empty State */}
              <div className="flex flex-col items-center justify-center">
                <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mb-6">
                  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                    <rect x="8" y="12" width="32" height="24" rx="4" className="fill-muted"/>
                    <path d="M16 20h16M16 26h10" className="stroke-muted-foreground" strokeWidth="2" strokeLinecap="round"/>
                    <circle cx="36" cy="36" r="8" className="fill-primary/15"/>
                    <path d="M33 36l2 2 4-4" className="stroke-primary" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{t('emptyTitle')}</h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  Create your first API key to start integrating with our trading platform and automate your strategies.
                </p>
                <button
                  onClick={() => setShowTypeModal(true)}
                  className="px-6 py-3 bg-primary hover:bg-primary/85 text-primary-foreground font-medium rounded-xl transition-colors"
                >{t('createFirstKey')}</button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colName')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colType')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colApiKey')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colSecret')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colPermission')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colIpBound')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colCreated')}</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colExpires')}</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t('colActions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {apiKeys.map(key => {
                    const expiration = getDaysToExpiration(key.expiresAt);
                    return (
                      <tr key={key.id} className="hover:bg-muted transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                              <Key className="w-5 h-5 text-primary-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-foreground">{key.name}</p>
                              <p className="text-xs text-muted-foreground">{key.apiKeyUsage === 'transaction' ? 'API Transaction' : 'Third-Party'}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                            key.keyType === 'system' 
                              ? 'bg-muted text-primary'
                              : 'bg-accent text-foreground/80'
                          }`}>
                            {key.keyType === 'system' ? 'HMAC' : 'RSA'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-foreground/80 bg-accent px-2 py-1 rounded">
                              {key.apiKey.slice(0, 8)}...{key.apiKey.slice(-4)}
                            </code>
                            <button
                              onClick={() => copyToClipboard(key.apiKey, `key-${key.id}`)}
                              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                            >
                              {copiedKey === `key-${key.id}` ? (
                                <Check className="w-4 h-4 text-buy" />
                              ) : (
                                <Copy className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <code className="text-sm font-mono text-foreground/80 bg-accent px-2 py-1 rounded">
                              {visibleSecrets.has(key.id) ? key.apiSecret?.slice(0, 16) + '...' : '••••••••••••'}
                            </code>
                            <button
                              onClick={() => toggleSecretVisibility(key.id)}
                              className="p-1.5 hover:bg-accent rounded-lg transition-colors"
                            >
                              {visibleSecrets.has(key.id) ? (
                                <EyeOff className="w-4 h-4 text-muted-foreground" />
                              ) : (
                                <Eye className="w-4 h-4 text-muted-foreground" />
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium ${
                            key.permission === 'read_write'
                              ? 'bg-buy-light text-buy'
                              : 'bg-accent text-foreground/70'
                          }`}>
                            {key.permission === 'read_write' ? 'Read-Write' : 'Read-Only'}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {key.ipAddresses.length > 0 ? (
                            <span className="inline-flex items-center gap-1 text-sm text-buy">
                              <Shield className="w-4 h-4" />
                              {key.ipAddresses.length} IPs
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">{t('none')}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {formatDate(key.createdAt)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-sm font-medium ${expiration.color}`}>
                            {expiration.text}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(key)}
                              className="p-2 rounded-lg hover:bg-accent transition-colors"
                              title={t('editApiKeyAria')}
                              aria-label={`Edit API key ${key.name}`}
                            >
                              <Edit3 className="w-4 h-4 text-muted-foreground" aria-hidden />
                            </button>
                            {revokeConfirmId === key.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setRevokeConfirmId(null)}
                                  disabled={!!deletingId}
                                  className="px-2.5 py-1.5 text-xs font-medium rounded-md border border-border text-muted-foreground hover:bg-accent disabled:opacity-50"
                                >{t('cancel')}</button>
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteKey(key)}
                                  disabled={!!deletingId}
                                  className="px-2.5 py-1.5 text-xs font-semibold rounded-md border border-sell/30 text-sell hover:bg-sell-light disabled:opacity-50"
                                >
                                  {deletingId === key.id ? 'Revoking…' : 'Confirm revoke'}
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setRevokeConfirmId(key.id)}
                                disabled={!!deletingId}
                                className="p-2 hover:bg-sell-light rounded-lg transition-colors disabled:opacity-50"
                                title={t('deleteApiKeyAria')}
                                aria-label={`Delete API key ${key.name}`}
                              >
                                {deletingId === key.id ? (
                                  <Loader2 className="w-4 h-4 text-sell animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 text-sell" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Security Notice */}
        <div className="mt-6 p-4 bg-warning-light border border-warning/30 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-foreground/90">
              <p className="font-medium mb-1">{t('securityNoticeTitle')}</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>{t('secTip1')}</li>
                <li>{t('secTip2')}</li>
                <li>{t('secTip3')}</li>
                <li>Use read-only permissions when write access isn&apos;t needed</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Edit API Key Modal */}
      {editKey && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{t('editModalTitle')}</h2>
              <button onClick={() => setEditKey(null)} className="p-2 hover:bg-accent rounded-xl transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('keyName')}</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder={t('myTradingKeyPlaceholder')}
                  maxLength={255}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('colPermission')}</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['read_only', 'read_write'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setEditPermission(p)}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        editPermission === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {p === 'read_only' ? 'Read-Only' : 'Read-Write'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">{t('withdrawalsDisabledNote')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">{t('ipRestrictionLabel')}</label>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  {(['no_restriction', 'ip_only'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setEditIpRestriction(r)}
                      className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        editIpRestriction === r ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:bg-accent'
                      }`}
                    >
                      {r === 'no_restriction' ? 'No restriction' : 'Bind to IPs'}
                    </button>
                  ))}
                </div>
                {editIpRestriction === 'ip_only' && (
                  <input
                    type="text"
                    value={editIpInput}
                    onChange={(e) => setEditIpInput(e.target.value)}
                    className="w-full px-3 py-2.5 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder={t('ipListPlaceholder')}
                  />
                )}
                <p className="text-xs text-muted-foreground mt-1.5">
                  {editIpRestriction === 'ip_only' ? 'IP-bound keys never auto-expire.' : 'Unrestricted keys expire 90 days after this change.'}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-6 border-t border-border">
              <button onClick={() => setEditKey(null)} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-muted-foreground hover:bg-accent">{t('cancel')}</button>
              <button
                onClick={() => void handleUpdateKey()}
                disabled={savingEdit}
                className="px-5 py-2.5 text-sm font-semibold rounded-lg bg-primary hover:bg-primary/85 text-primary-foreground disabled:opacity-50 flex items-center gap-2"
              >
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select API Key Type Modal */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold text-foreground">{t('typeModalTitle')}</h2>
              <button
                onClick={() => setShowTypeModal(false)}
                className="p-2 hover:bg-accent rounded-xl transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Options */}
            <div className="p-6 space-y-4">
              {/* System-generated */}
              <button
                onClick={() => handleCreateKey('system')}
                className="w-full p-5 bg-gradient-to-r from-muted to-muted/80 border-2 border-transparent hover:border-primary rounded-xl transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-blue-500/25">
                    <Key className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">{t('systemKeysTitle')}</h3>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Uses <span className="font-semibold text-primary">{t('hmacEncryption')}</span>. You&apos;ll receive a public and private key pair. Keep them secure like passwords.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 bg-muted text-primary text-xs font-medium rounded">{t('recommended')}</span>
                      <span className="px-2 py-1 bg-accent text-muted-foreground text-xs rounded">{t('easierSetup')}</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Self-generated */}
              <button
                onClick={() => handleCreateKey('self')}
                className="w-full p-5 bg-gradient-to-r from-muted to-muted/80 border-2 border-transparent hover:border-primary rounded-xl transition-all text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-purple-500/25">
                    <Shield className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-bold text-foreground">{t('selfKeysTitle')}</h3>
                      <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      Uses <span className="font-semibold text-primary">{t('rsaEncryption')}</span>. Create your own key pair locally. We only store your public key - maximum security.
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <span className="px-2 py-1 bg-muted text-primary text-xs font-medium rounded">{t('advanced')}</span>
                      <span className="px-2 py-1 bg-accent text-muted-foreground text-xs rounded">{t('apiV3V5')}</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
