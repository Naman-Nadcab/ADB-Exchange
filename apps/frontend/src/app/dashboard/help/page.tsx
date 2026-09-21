'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  HelpCircle, Search, Download, Upload, Shield, Key,
  CreditCard, BarChart3, Users, ChevronDown, ChevronRight,
} from 'lucide-react';

const CATEGORY_KEYS = [
  'all',
  'deposit',
  'withdraw',
  'trading',
  'security',
  'account',
  'fees',
  'p2p',
] as const;

type CategoryKey = (typeof CATEGORY_KEYS)[number];

const CATEGORY_ICONS: Record<CategoryKey, typeof HelpCircle> = {
  all: HelpCircle,
  deposit: Download,
  withdraw: Upload,
  trading: BarChart3,
  security: Shield,
  account: Key,
  fees: CreditCard,
  p2p: Users,
};

const HELP_ITEM_IDS = [
  'deposit-how',
  'deposit-wrong',
  'deposit-pending',
  'withdraw-how',
  'withdraw-fiat',
  'withdraw-limits',
  'trade-spot',
  'trade-types',
  'trade-transfer',
  'security-2fa',
  'security-passkeys',
  'security-fund-pwd',
  'security-anti-phish',
  'account-kyc',
  'account-api',
  'fiat-fees',
  'vip-requirements',
  'p2p-how',
  'p2p-dispute',
  'mnt-discount',
] as const;

type HelpItemId = (typeof HELP_ITEM_IDS)[number];

const HELP_ITEMS: { id: HelpItemId; category: Exclude<CategoryKey, 'all'> }[] = [
  { id: 'deposit-how', category: 'deposit' },
  { id: 'deposit-wrong', category: 'deposit' },
  { id: 'deposit-pending', category: 'deposit' },
  { id: 'withdraw-how', category: 'withdraw' },
  { id: 'withdraw-fiat', category: 'withdraw' },
  { id: 'withdraw-limits', category: 'withdraw' },
  { id: 'trade-spot', category: 'trading' },
  { id: 'trade-types', category: 'trading' },
  { id: 'trade-transfer', category: 'trading' },
  { id: 'security-2fa', category: 'security' },
  { id: 'security-passkeys', category: 'security' },
  { id: 'security-fund-pwd', category: 'security' },
  { id: 'security-anti-phish', category: 'security' },
  { id: 'account-kyc', category: 'account' },
  { id: 'account-api', category: 'account' },
  { id: 'fiat-fees', category: 'fees' },
  { id: 'vip-requirements', category: 'fees' },
  { id: 'p2p-how', category: 'p2p' },
  { id: 'p2p-dispute', category: 'p2p' },
  { id: 'mnt-discount', category: 'fees' },
];

export default function HelpPage() {
  const th = useTranslations('account.help');
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryKey>('all');
  const [expandedId, setExpandedId] = useState<HelpItemId | null>(null);

  const filtered = useMemo(() => {
    let items = HELP_ITEMS;
    if (activeCategory !== 'all') items = items.filter((i) => i.category === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter((i) => {
        const title = th(`items.${i.id}.title`).toLowerCase();
        const content = th(`items.${i.id}.content`).toLowerCase();
        return title.includes(q) || content.includes(q);
      });
    }
    return items;
  }, [search, activeCategory, th]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">{th('title')}</h1>
        </div>
        <Link
          href="/dashboard/support"
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {th('contactSupport')}
        </Link>
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder={th('searchPlaceholder')}
          className="h-10 w-full rounded-xl border border-border bg-card pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Category pills */}
      <div className="mb-5 flex flex-wrap gap-1.5">
        {CATEGORY_KEYS.map((key) => {
          const Icon = CATEGORY_ICONS[key];
          return (
            <button key={key} type="button" onClick={() => setActiveCategory(key)}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                activeCategory === key
                  ? 'bg-primary text-primary-foreground'
                  : 'border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {th(`categories.${key}`)}
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {filtered.length === 1
          ? th('topicCountOne', { count: filtered.length })
          : th('topicCountOther', { count: filtered.length })}
      </p>

      {/* FAQ accordion */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">{th('noResults')}</p>
          </div>
        ) : filtered.map((item) => {
          const isOpen = expandedId === item.id;
          return (
            <div key={item.id} id={item.id} className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <button type="button" onClick={() => setExpandedId(isOpen ? null : item.id)}
                className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/50 transition-colors"
              >
                <span className="text-sm font-medium text-foreground">{th(`items.${item.id}.title`)}</span>
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
              </button>
              {isOpen && (
                <div className="border-t border-border px-4 py-3">
                  <p className="text-xs leading-relaxed text-muted-foreground">{th(`items.${item.id}.content`)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-8 rounded-xl border border-border bg-card p-4 text-center shadow-sm">
        <p className="text-sm font-medium text-foreground">{th('footerStillNeedHelp')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{th('footerDesc')}</p>
        <div className="mt-3 flex items-center justify-center gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
            {th('backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  );
}
