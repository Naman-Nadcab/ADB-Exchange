'use client';

/**
 * DEPRECATED ROUTE — consolidated into the Integrations Center.
 * Blockchain RPC / node providers are now the single source of truth in
 * `/system/integrations` (api_settings + live `chains` sync via the RPC bridge).
 * This stub keeps the old bookmarked URL working by redirecting.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function DeprecatedNodesRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/system/integrations');
  }, [router]);
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-admin-muted">
      <Loader2 className="h-5 w-5 animate-spin" />
      Node providers moved to the Integrations Center. Redirecting…
    </div>
  );
}
