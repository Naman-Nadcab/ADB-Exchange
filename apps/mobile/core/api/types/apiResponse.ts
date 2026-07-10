/** Backend API envelope — frozen at SHA 0098864 */

export type ApiErrorBody = {
  code: string;
  message: string;
};

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: ApiErrorBody;
  message?: string;
};

export function unwrapApiData<T>(body: unknown): T {
  if (!body || typeof body !== 'object') {
    throw new Error('Invalid API response');
  }
  const envelope = body as ApiResponse<T>;
  if (envelope.success === false) {
    const err = envelope.error;
    throw new Error(err?.message ?? 'Request failed');
  }
  if (envelope.data !== undefined) return envelope.data;
  if (envelope.success === true) return {} as T;
  return body as T;
}
