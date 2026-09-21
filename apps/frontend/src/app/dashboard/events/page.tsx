'use client';

import { useTranslations } from 'next-intl';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, Gift, Trophy, Zap, Clock, ArrowRight, Bell, BellOff, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/toaster';
import { useAuthStore } from '@/store/auth';
import { getPushStatus, enablePushNotifications, disablePushNotifications, type PushStatus } from '@/lib/pushNotifications';

const UPCOMING = [
  { key: 'tradingCompetition' as const, icon: Trophy, color: 'text-amber-500 bg-amber-500/10' },
  { key: 'referralBonus' as const, icon: Gift, color: 'text-primary bg-primary/10' },
  { key: 'listingAirdrops' as const, icon: Zap, color: 'text-buy bg-buy/10' },
];

export default function EventsPage() {
  const te = useTranslations('account.events');
  const tn = useTranslations('common.notifications');
  const tt = useTranslations('account.toasts');
  const { accessToken } = useAuthStore();
  const [pushStatus, setPushStatus] = useState<PushStatus>({ supported: false, permission: 'default', subscribed: false });
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    getPushStatus().then(setPushStatus).catch(() => {});
  }, []);

  const handleTogglePush = async () => {
    if (!accessToken) {
      toast({ title: tt('signInRequiredTitle'), description: tt('signInForNotifications'), variant: 'default' });
      return;
    }
    if (!pushStatus.supported) {
      toast({ title: tn('notSupportedTitle'), description: tt('pushNotSupportedDesc'), variant: 'destructive' });
      return;
    }
    if (pushStatus.permission === 'denied') {
      toast({ title: tt('notificationsBlockedTitle'), description: tt('notificationsBlockedDesc'), variant: 'destructive' });
      return;
    }
    setPushBusy(true);
    try {
      if (pushStatus.subscribed) {
        const r = await disablePushNotifications(accessToken);
        if (r.ok) {
          toast({ title: tt('notificationsDisabledTitle'), variant: 'success' });
        } else {
          toast({ title: tn('errorTitle'), description: r.error || tt('settingUpdateFailed'), variant: 'destructive' });
        }
      } else {
        const r = await enablePushNotifications(accessToken);
        if (r.ok) {
          toast({ title: tt('notificationsEnabledTitle'), description: tt('notificationsEnabledDesc'), variant: 'success' });
        } else {
          toast({ title: tt('couldNotEnableTitle'), description: r.error || tt('settingUpdateFailed'), variant: 'destructive' });
        }
      }
      setPushStatus(await getPushStatus());
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="mb-6 flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h1 className="text-xl font-semibold text-foreground">{te('title')}</h1>
      </div>

      {/* Status banner */}
      <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/10">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{te('noActiveTitle')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{te('noActiveDesc')}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleTogglePush()}
          disabled={pushBusy}
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {pushBusy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : pushStatus.subscribed ? (
            <BellOff className="h-3.5 w-3.5" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          {pushStatus.subscribed ? te('disableNotifications') : te('enableNotifications')}
        </button>
      </div>

      {/* Upcoming events preview */}
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{te('comingSoon')}</h2>
      <div className="space-y-3">
        {UPCOMING.map((item) => (
          <div key={item.key} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.color}`}>
              <item.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground">{te(`upcoming.${item.key}.title`)}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{te(`upcoming.${item.key}.desc`)}</p>
            </div>
            <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{te('soonBadge')}</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-6 text-center">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors">
          {te('backToDashboard')} <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
