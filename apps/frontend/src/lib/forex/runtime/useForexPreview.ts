'use client';

import { useEffect, useRef, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { hasForexBearer } from '../api/auth-token';
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
import { useForexStore } from '../state/store';

const DEBOUNCE_MS = 400;

export function useForexPreview(request: ForexPreviewRequest | null, refreshNonce = 0) {
  const [view, setView] = useState<ForexPreviewView>(idlePreviewView);
  const genRef = useRef(0);
  const keyRef = useRef('');
  const liveSeq = useForexStore((s) => (request ? s.quotes[request.symbol]?.sequence : undefined));

  useEffect(() => {
    if (!request || !isPreviewParamComplete(request) || !hasForexBearer()) {
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
    setView(loadingPreviewView(request));

    const timer = window.setTimeout(() => {
      void (async () => {
        const res = await forexApi.previewOrder(request, controller.signal);
        const incoming = { key, generation };
        const active = { key: keyRef.current, generation: genRef.current };
        if (isStalePreviewRequest(active, incoming)) return;
        const u = unwrap(res);
        const quoteSeq = useForexStore.getState().quotes[request.symbol]?.sequence;
        setView(
          interpretForexPreviewResult({
            request,
            ok: u.ok,
            data: u.ok ? u.data : undefined,
            error: u.ok ? undefined : u.error,
            liveQuoteSequence: quoteSeq,
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
  }, [request?.symbol, request?.side, request?.orderType, request?.volume, request?.requestedPrice, refreshNonce]);

  useEffect(() => {
    if (view.status !== 'READY' && view.status !== 'BLOCKED') return;
    if (!liveSeq || !view.data?.quoteSequence) return;
    if (liveSeq !== view.data.quoteSequence) {
      setView((cur) => (cur.data ? { ...cur, status: 'STALE' } : cur));
    }
  }, [liveSeq, view.status, view.data?.quoteSequence]);

  return view;
}
