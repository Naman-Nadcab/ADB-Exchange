'use client';

/**
 * DEPRECATED ROUTE — consolidated into the Integrations Center.
 * Infrastructure providers (storage, monitoring, analytics, etc.) are now the
 * single source of truth in `/system/integrations` (api_settings). This stub
 * keeps the old bookmarked URL working by redirecting.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedInfrastructureRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/system/integrations');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-admin-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      Infrastructure providers moved to the Integrations Center. Redirecting…
    </div>
  );
}
