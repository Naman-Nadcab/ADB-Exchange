import { FOREX_ADMIN_ROUTES } from '@/lib/admin/forex-admin-nav';
import { ForexSectionPage } from '@/components/forex/ForexSectionPage';
import { notFound } from 'next/navigation';

export function makeForexSectionPage(sectionId: string) {
  return function ForexSectionRoutePage() {
    const route = FOREX_ADMIN_ROUTES.find((r) => r.id === sectionId);
    if (!route) notFound();
    return <ForexSectionPage route={route} />;
  };
}
