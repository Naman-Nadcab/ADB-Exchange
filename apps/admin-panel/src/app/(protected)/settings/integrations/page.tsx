'use client';

/**
 * DEPRECATED ROUTE — consolidated into the Integrations Center.
 * Compliance providers (KYC / AML / Travel Rule) are now the single source of
 * truth in `/system/integrations` (api_settings). This stub keeps the old
 * bookmarked URL working by redirecting.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedComplianceProvidersRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/system/integrations');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-admin-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      Compliance providers moved to the Integrations Center. Redirecting…
    </div>
  );
}
