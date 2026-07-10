type Handler = (payload: unknown) => void;

const handlers = new Map<string, Set<Handler>>();

export const appEventBus = {
  on(event: string, handler: Handler) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event)!.add(handler);
    return () => {
      handlers.get(event)?.delete(handler);
    };
  },
  emit(event: string, payload?: unknown) {
    handlers.get(event)?.forEach((h) => h(payload));
  },
};
