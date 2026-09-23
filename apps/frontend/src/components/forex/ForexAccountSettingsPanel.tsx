'use client';

import { useTranslations } from 'next-intl';
import { ForexPortalModuleCard } from './ForexPortalKpiCard';
import { ForexPositionModeSwitch } from './ForexPositionModeSwitch';
import { fxPlain } from './format';

export function ForexAccountSettingsPanel(props: {
  isSelected: boolean;
  positionMode?: string;
  leverageLabel: string;
  groupLabel?: string | null;
}) {
  const t = useTranslations('forex.accountSettings');

  return (
    <ForexPortalModuleCard title={t('title')} subtitle={t('subtitle')}>
      <dl className="mb-3 grid gap-2 sm:grid-cols-2 text-[12px]">
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('leverage')}</dt>
          <dd className="mt-0.5">{props.leverageLabel}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase text-muted-foreground">{t('accountGroup')}</dt>
          <dd className="mt-0.5">{props.groupLabel ? fxPlain(props.groupLabel) : t('groupDefault')}</dd>
        </div>
      </dl>
      {!props.isSelected ? (
        <p className="text-[12px] text-muted-foreground">{t('switchToEdit')}</p>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-muted-foreground">{t('positionModeHint')}</p>
          <ForexPositionModeSwitch />
        </>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground">{t('leverageRequestHint')}</p>
    </ForexPortalModuleCard>
  );
}
