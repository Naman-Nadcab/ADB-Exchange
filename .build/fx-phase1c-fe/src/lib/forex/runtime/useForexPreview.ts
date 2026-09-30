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

export function useForexPreview(request: ForexPreviewRequest | null, refreshNonce = 0) {
  const [view, setView] = useState<ForexPreviewView>(idlePreviewView);
  const [tickRefresh, setTickRefresh] = useState(0);
  const genRef = useRef(0);
  const keyRef = useRef('');

  useEffect(() => {
    if (!request) return;
    const id = window.setInterval(() => setTickRefresh((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [request?.symbol, request?.side, request?.orderType, request?.volume, request?.requestedPrice]);

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
    setView((cur) => {
      if (cur.data && cur.request && previewRequestKey(cur.request) === key) {
        return cur;
      }
      return loadingPreviewView(request);
    });

    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await forexApi.previewOrder(request, controller.signal);
        const incoming = { key, generation };
        const active = { key: keyRef.current, generation: genRef.current };
        if (isStalePreviewRequest(active, incoming)) return;
        const u = unwrap(res);
        setView(
          interpretForexPreviewResult({
            request,
            ok: u.ok,
            data: u.ok ? u.data : undefined,
            error: u.ok ? undefined : u.error,
          })
        );
      })().catch((err: unknown) => {
        const incoming = { key, generation };
        const active = { key: keyRef.current, generation: genRef.current };
        if (isStalePreviewRequest(active, incoming)) return;
        const error = normalizeForexError(err, err instanceof Error ? err.message : 'Forex preview failed');
        if (error.code === 'ABORTED') return;
        setView(interpretForexPreviewResult({ request, ok: false, error }));
      });
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [request?.symbol, request?.side, request?.orderType, request?.volume, request?.requestedPrice, refreshNonce, tickRefresh]);

  return view;
}
