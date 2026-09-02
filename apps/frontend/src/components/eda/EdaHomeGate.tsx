'use client';

import { useAuthStore } from '@/store/auth';
import { EdaCustomerHome } from '@/components/eda/EdaCustomerHome';
import { EdaPublicHome } from '@/components/eda/EdaPublicHome';

export function EdaHomeGate() {
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const authed = useAuthStore((s) => s.isAuthenticated);

  if (!hydrated) {
    return (
      <div className="min-h-screen bg-[#05070B] text-[#9CA3AF]">
        <p className="px-6 py-10 font-mono text-[12px]">Loading EDA…</p>
      </div>
    );
  }

  return authed ? <EdaCustomerHome /> : <EdaPublicHome />;
}
