'use client';

import { useTranslations } from 'next-intl';
import { Key, Shield, Lock, Wallet } from 'lucide-react';

export interface APIPermissionSummaryProps {
  keyName: string;
  permission: 'read_write' | 'read_only';
  ipRestriction: 'ip_only' | 'no_restriction';
  ipAddressCount: number;
  withdrawalAccess: 'enabled' | 'disabled' | 'read_only';
  enabledPermissions: string[];
}

const PERMISSION_SCOPE_KEYS = [
  'unifiedTrading',
  'spotTrade',
  'earn',
  'earnFlexibleSavings',
  'fiatTrading',
  'p2pOrders',
  'p2pAds',
  'assets',
  'walletAccountTransfer',
  'walletSubaccountTransfer',
  'walletWithdrawal',
  'exchangeConvertHistory',
  'contractOrders',
  'contractPositions',
  'usdcDerivativesTrading',
  'bybitPayOrders',
  'cryptoFiatOrders',
] as const;

type PermissionScopeKey = (typeof PERMISSION_SCOPE_KEYS)[number];

function isPermissionScopeKey(k: string): k is PermissionScopeKey {
  return (PERMISSION_SCOPE_KEYS as readonly string[]).includes(k);
}

export function APIPermissionSummary({
  keyName,
  permission,
  ipRestriction,
  ipAddressCount,
  withdrawalAccess,
  enabledPermissions,
}: APIPermissionSummaryProps) {
  const t = useTranslations('account.apiPermissionSummary');

  return (
    <div className="bg-card rounded-xl p-5 border border-border">
      <h3 className="text-sm font-semibold text-foreground mb-4">{t('title')}</h3>
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Key className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('keyName')}</span>
          </div>
          <p className="text-sm font-medium text-foreground truncate">
            {keyName || '—'}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('permissions')}</span>
          </div>
          <p className="text-sm text-foreground">
            {permission === 'read_only' ? t('readOnly') : t('readWrite')}
          </p>
          {enabledPermissions.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {enabledPermissions.slice(0, 6).map((k) => (
                <span
                  key={k}
                  className="px-2 py-0.5 bg-accent text-foreground/80 text-xs rounded"
                >
                  {isPermissionScopeKey(k) ? t(`scopes.${k}`) : k}
                </span>
              ))}
              {enabledPermissions.length > 6 && (
                <span className="px-2 py-0.5 text-muted-foreground text-xs">
                  {t('moreCount', { count: enabledPermissions.length - 6 })}
                </span>
              )}
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('ipRestrictions')}</span>
          </div>
          <p className="text-sm text-foreground">
            {ipRestriction === 'ip_only'
              ? ipAddressCount > 0
                ? t('ipsWhitelisted', { count: ipAddressCount })
                : t('ipWhitelistEmpty')
              : t('noRestriction')}
          </p>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Wallet className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('withdrawalAccess')}</span>
          </div>
          <p className={`text-sm font-medium ${
            withdrawalAccess === 'enabled' ? 'text-buy' :
            withdrawalAccess === 'read_only' ? 'text-amber-600 dark:text-amber-400' :
            'text-muted-foreground'
          }`}>
            {withdrawalAccess === 'enabled'
              ? t('withdrawalEnabled')
              : withdrawalAccess === 'read_only'
                ? t('withdrawalReadOnly')
                : t('withdrawalDisabled')}
          </p>
        </div>
      </div>
    </div>
  );
}
