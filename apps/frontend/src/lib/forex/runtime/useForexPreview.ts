'use client';

import { useEffect, useRef, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { hasForexPrivateSession } from '../api/auth-token';
import {
  idlePreviewView,
  interpretForexPreviewResult,
  isPreviewParamComplete,
  isStalePreviewRequest,
  loadingPreviewView,
  previewRequestKey,
  type ForexPreviewRequest,
  type ForexPreviewView,
} from '../models/preview';
import { normalizeForexError } from '../models/errors';

const DEBOUNCE_MS = 400;
const REFRESH_MS = 8000;

export function useForexPreview(request: ForexPreviewRequest | null, refreshNonce = 0) {
  const [view, setView] = useState<ForexPreviewView>(idlePreviewView);
  const genRef = useRef(0);
  const keyRef = useRef('');

  useEffect(() => {
    if (!request || !isPreviewParamComplete(request) || !hasForexPrivateSession()) {
      genRef.current += 1;
      keyRef.current = '';
      setView(idlePreviewView());
      return;
    }

    const key = previewRequestKey(request);
    genRef.current += 1;
    const generation = genRef.current;
    keyRef.current = key;
    const controller = new AbortController();
    let stopped = false;
    setView((cur) => {
      if (cur.data && cur.request && previewRequestKey(cur.request) === key) {
        return cur;
      }
      return loadingPreviewView(request);
    });

    const apply = (res: Awaited<ReturnType<typeof forexApi.previewOrder>>) => {
      const incoming = { key, generation };
      const active = { key: keyRef.current, generation: genRef.current };
      if (stopped || isStalePreviewRequest(active, incoming)) return;
      const u = unwrap(res);
      setView(
        interpretForexPreviewResult({
          request,
          ok: u.ok,
          data: u.ok ? u.data : undefined,
          error: u.ok ? undefined : u.error,
        })
      );
    };

    const fail = (err: unknown) => {
      const incoming = { key, generation };
      const active = { key: keyRef.current, generation: genRef.current };
      if (stopped || isStalePreviewRequest(active, incoming)) return;
      const error = normalizeForexError(err, err instanceof Error ? err.message : 'Forex preview failed');
      if (error.code === 'ABORTED') return;
      setView(interpretForexPreviewResult({ request, ok: false, error }));
    };

    const timer = window.setTimeout(() => {
      void forexApi.previewOrder(request, controller.signal).then(apply).catch(fail);
    }, DEBOUNCE_MS);

    // Refresh margin in the background. Do not abort the request the buttons are waiting on.
    const refresh = window.setInterval(() => {
      void forexApi.previewOrder(request).then(apply).catch(fail);
    }, REFRESH_MS);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      window.clearInterval(refresh);
      controller.abort();
    };
  }, [request?.symbol, request?.side, request?.orderType, request?.volume, request?.requestedPrice, request?.limitPrice, refreshNonce]);

  return view;
}
