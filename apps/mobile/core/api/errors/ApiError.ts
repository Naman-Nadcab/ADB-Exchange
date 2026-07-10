import type { ApiErrorBody, ApiResponse } from '../types/apiResponse';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(status: number, body: unknown): ApiError {
    if (body && typeof body === 'object') {
      const envelope = body as ApiResponse<unknown>;
      if (envelope.success === false && envelope.error) {
        const err = envelope.error as ApiErrorBody;
        return new ApiError(err.message ?? 'Request failed', status, err.code, body);
      }
      const record = body as Record<string, unknown>;
      if (record.error && typeof record.error === 'object') {
        const err = record.error as ApiErrorBody;
        return new ApiError(err.message ?? 'Request failed', status, err.code, body);
      }
      const message =
        typeof record.message === 'string'
          ? record.message
          : typeof record.error === 'string'
            ? record.error
            : 'Request failed';
      const code = typeof record.code === 'string' ? record.code : undefined;
      return new ApiError(message, status, code, body);
    }
    return new ApiError('Request failed', status, undefined, body);
  }
}
