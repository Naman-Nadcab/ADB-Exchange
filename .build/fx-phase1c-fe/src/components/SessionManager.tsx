'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/store/auth';
import { useAuth } from '@/context/AuthContext';

interface SessionManagerProps {
  redirectPath?: string;
}

/**
 * SessionManager - Cross-tab logout sync only.
 * Auth redirects use hard navigation; no automatic idle logout.
 */
export default function SessionManager({
  redirectPath = '/login',
}: SessionManagerProps) {
  const { setUnauthenticated } = useAuth();
  const { isAuthenticated, accessToken } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !accessToken) return;

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'auth-storage') {
        try {
          const newValue = e.newValue ? JSON.parse(e.newValue) : null;
          if (!newValue?.state?.isAuthenticated) {
            setUnauthenticated();
            window.location.assign(redirectPath);
          }
        } catch (_) {}
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [isAuthenticated, accessToken, setUnauthenticated, redirectPath]);

  return null;
}
