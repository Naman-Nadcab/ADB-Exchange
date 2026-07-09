'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/cn';

type ToastKind = 'success' | 'error' | 'warning';

type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type AdminToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
};

const AdminToastContext = createContext<AdminToastContextValue | null>(null);

export function AdminToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const idRef = useRef(0);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const show = useCallback(
    (kind: ToastKind, message: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      idRef.current += 1;
      setToast({ id: idRef.current, kind, message });
      timerRef.current = setTimeout(() => setToast(null), 5000);
    },
    []
  );

  const value: AdminToastContextValue = {
    success: useCallback((message: string) => show('success', message), [show]),
    error: useCallback((message: string) => show('error', message), [show]),
    warning: useCallback((message: string) => show('warning', message), [show]),
  };

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return (
    <AdminToastContext.Provider value={value}>
      {children}
      {toast ? (
        <div
          role="alert"
          aria-live="polite"
          className={cn(
            'fixed bottom-6 right-6 z-[9999] flex max-w-md items-start gap-3 rounded-xl border px-4 py-3 shadow-2xl text-sm font-medium',
            toast.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-950/95 text-emerald-300'
              : toast.kind === 'warning'
                ? 'border-amber-500/30 bg-amber-950/95 text-amber-200'
                : 'border-red-500/30 bg-red-950/95 text-red-300'
          )}
        >
          {toast.kind === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <span className="leading-snug">{toast.message}</span>
          <button type="button" onClick={dismiss} className="ml-1 shrink-0 opacity-60 hover:opacity-100" aria-label="Dismiss">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </AdminToastContext.Provider>
  );
}

export function useAdminToast(): AdminToastContextValue {
  const ctx = useContext(AdminToastContext);
  if (!ctx) {
    throw new Error('useAdminToast must be used within AdminToastProvider');
  }
  return ctx;
}

/** Inline banner for form-level save feedback (shown next to Save buttons). */
export function AdminSaveBanner({
  kind,
  message,
}: {
  kind: 'success' | 'error';
  message: string;
}) {
  return (
    <p
      role="status"
      className={cn(
        'rounded-lg border px-3 py-2 text-xs font-medium',
        kind === 'success'
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-red-500/25 bg-red-500/10 text-red-300'
      )}
    >
      {message}
    </p>
  );
}
