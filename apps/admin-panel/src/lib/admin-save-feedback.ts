import { useMutation, type QueryClient, type UseMutationOptions } from '@tanstack/react-query';
import { useAdminToast } from '@/components/admin-shell/AdminToast';
import { AdminApiError, formatAdminError } from '@/lib/api';

export function saveCancelledMessage(error: unknown): string | null {
  if (error instanceof AdminApiError && error.code === 'CANCELLED') {
    return 'Save cancelled. Enter a reason (minimum 8 characters) and confirm to apply changes.';
  }
  return null;
}

export function formatSaveError(error: unknown, fallback: string): string {
  return saveCancelledMessage(error) ?? formatAdminError(error, fallback);
}

export async function refetchAdminQueries(
  queryClient: QueryClient,
  queryKeyPrefix: readonly string[]
): Promise<void> {
  await queryClient.refetchQueries({ queryKey: [...queryKeyPrefix] });
}

type ToastApi = { success: (message: string) => void; error: (message: string) => void };

/** Wrap mutation handlers with global toast + optional invalidation refetch. */
export function withAdminSaveFeedback<TData, TError, TVariables, TContext>(
  toast: ToastApi,
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    successMessage: string | ((data: TData, variables: TVariables) => string);
    errorMessage?: string;
  }
): UseMutationOptions<TData, TError, TVariables, TContext> {
  const { successMessage, errorMessage = 'Save failed', onSuccess, onError, ...rest } = options;
  return {
    ...rest,
    onSuccess: (...args) => {
      const [data, variables] = args;
      const msg = typeof successMessage === 'function' ? successMessage(data, variables) : successMessage;
      toast.success(msg);
      onSuccess?.(...args);
    },
    onError: (...args) => {
      const [error] = args;
      toast.error(formatSaveError(error, errorMessage));
      onError?.(...args);
    },
  };
}

/** useMutation with automatic admin toast on success/error. */
export function useAdminSaveMutation<TData, TError, TVariables, TContext>(
  options: UseMutationOptions<TData, TError, TVariables, TContext> & {
    successMessage: string | ((data: TData, variables: TVariables) => string);
    errorMessage?: string;
  }
) {
  const toast = useAdminToast();
  return useMutation(withAdminSaveFeedback(toast, options));
}
