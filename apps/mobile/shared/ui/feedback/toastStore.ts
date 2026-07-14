import { create } from 'zustand';

export type ToastTone = 'default' | 'success' | 'error' | 'warning';

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
  duration: number;
};

type ToastState = {
  queue: ToastItem[];
  show: (item: Omit<ToastItem, 'id'>) => void;
  dismiss: (id: string) => void;
};

export const useToastStore = create<ToastState>((set) => ({
  queue: [],
  show: (item) =>
    set((s) => ({
      queue: [...s.queue, { ...item, id: `${Date.now()}-${Math.random()}` }],
    })),
  dismiss: (id) => set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
}));

export function showToast(title: string, opts?: { message?: string; tone?: ToastTone; duration?: number }) {
  useToastStore.getState().show({
    title,
    message: opts?.message,
    tone: opts?.tone ?? 'default',
    duration: opts?.duration ?? 3500,
  });
}

export function showSnackbar(title: string, message?: string) {
  showToast(title, { message, tone: 'default' });
}
