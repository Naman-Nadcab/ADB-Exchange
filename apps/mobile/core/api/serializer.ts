/** Serialize request/response bodies — JSON foundation only. */

export function serializeBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return JSON.stringify(body);
}

export function deserializeBody<T>(text: string): T | null {
  if (!text) return null;
  return JSON.parse(text) as T;
}
