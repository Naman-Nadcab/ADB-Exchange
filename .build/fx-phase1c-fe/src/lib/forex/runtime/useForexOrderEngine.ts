'use client';

import { useCallback, useRef, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { describeForexError, normalizeForexError } from '../models/errors';
import { requiresLimitPrice, requiresTriggerPrice } from '../models/order-type-tif';
import type {
  ForexError,
  ForexModifyOrderBody,
  ForexOrderType,
  ForexPlaceOrderBody,
  ForexPublicOrder,
  ForexPublicPosition,
  ForexSide,
  ForexTimeInForce,
} from '../models/types';
import { useForexStore } from '../state/store';
import { generateClientOrderId } from './client-id';
import { hydrateForexPrivate } from './hydrate';

export type PlaceOrderInput = {
  symbol: string;
  side: ForexSide;
  orderType: ForexOrderType;
  volume: string;
  /** Pending trigger price. For stop_limit this is the STOP price. */
  requestedPrice?: string;
  /** stop_limit only — the LIMIT price the order works at after the stop triggers. */
  limitPrice?: string;
  /** Omitted means the server default (GTC). */
  timeInForce?: ForexTimeInForce;
  /** Applied via /protections after fill when an open position exists. */
  stopLoss?: string;
  takeProfit?: string;
};

function isWorkingPending(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'ACCEPTED' || s === 'PENDING' || s === 'NEW' || s === 'TRIGGERING' || s === 'VALIDATING';
}

function isFilledLike(status: string): boolean {
  const s = status.toUpperCase();
  return s === 'FILLED' || s === 'PARTIALLY_FILLED';
}

async function attachProtections(
  position: ForexPublicPosition,
  stopLoss?: string,
  takeProfit?: string
): Promise<string[]> {
  const notes: string[] = [];
  const sl = stopLoss?.trim();
  const tp = takeProfit?.trim();
  if (sl) {
    const res = await forexApi.createProtection({
      clientProtectionId: `sl-${position.positionId.slice(0, 8)}-${Date.now()}`,
      positionId: position.positionId,
      type: 'STOP_LOSS',
      triggerPrice: sl,
    });
    const u = unwrap(res);
    notes.push(u.ok ? `SL set @ ${sl}` : `SL failed: ${describeForexError(u.error)}`);
  }
  if (tp) {
    const res = await forexApi.createProtection({
      clientProtectionId: `tp-${position.positionId.slice(0, 8)}-${Date.now()}`,
      positionId: position.positionId,
      type: 'TAKE_PROFIT',
      triggerPrice: tp,
    });
    const u = unwrap(res);
    notes.push(u.ok ? `TP set @ ${tp}` : `TP failed: ${describeForexError(u.error)}`);
  }
  return notes;
}

/**
 * Single order engine for ticket / chart / market watch.
 * Backend-authoritative: place → hydrate → optional post-fill protections.
 * Supported types: market | limit | stop | stop_limit.
 */
export function useForexOrderEngine() {
  const [busy, setBusy] = useState(false);
  const [lastOrder, setLastOrder] = useState<ForexPublicOrder | null>(null);
  const [lastNote, setLastNote] = useState<string | null>(null);
  const [error, setError] = useState<ForexError | null>(null);
  const lock = useRef(false);

  const place = useCallback(async (input: PlaceOrderInput) => {
    if (lock.current) return { ok: false as const, error: normalizeForexError({ code: 'BUSY', message: 'Order already submitting' }) };
    lock.current = true;
    setBusy(true);
    setError(null);
    setLastNote(null);
    const store = useForexStore.getState();
    store.setTicketBusy(true);
    store.setLastError(null);
    try {
      const clientOrderId = generateClientOrderId('fx');
      const body: ForexPlaceOrderBody = {
        clientOrderId,
        symbol: input.symbol,
        side: input.side,
        orderType: input.orderType,
        volume: input.volume,
        ...(requiresTriggerPrice(input.orderType) && input.requestedPrice?.trim()
          ? { requestedPrice: input.requestedPrice.trim() }
          : {}),
        ...(requiresLimitPrice(input.orderType) && input.limitPrice?.trim()
          ? { limitPrice: input.limitPrice.trim() }
          : {}),
        ...(input.timeInForce ? { timeInForce: input.timeInForce } : {}),
        ...(input.stopLoss?.trim() ? { stopLoss: input.stopLoss.trim() } : {}),
        ...(input.takeProfit?.trim() ? { takeProfit: input.takeProfit.trim() } : {}),
      };
      const res = await forexApi.placeOrder(body);
      const u = unwrap(res);
      if (!u.ok) {
        setError(u.error);
        store.setLastError(u.error);
        return { ok: false as const, error: u.error };
      }
      const order = u.data.order;
      setLastOrder(order);
      store.setTicketLastOrder(order);
      await hydrateForexPrivate();

      const notes: string[] = [`Order ${order.status}`];
      const wantProt = Boolean(input.stopLoss?.trim() || input.takeProfit?.trim());
      if (wantProt && isFilledLike(order.status)) {
        const positions = Object.values(useForexStore.getState().positions).filter(
          (p) => p.status === 'OPEN' && p.symbol === input.symbol
        );
        const pos = positions[0];
        if (pos) {
          const protNotes = await attachProtections(pos, input.stopLoss, input.takeProfit);
          notes.push(...protNotes);
          await hydrateForexPrivate();
        } else {
          notes.push('SL/TP pending — no open position found after fill; set from Positions.');
        }
      } else if (wantProt && isWorkingPending(order.status)) {
        notes.push('Pending order accepted. SL/TP attach after fill via Positions panel.');
      }

      const note = notes.join(' · ');
      setLastNote(note);
      return { ok: true as const, order, note };
    } catch (e) {
      const err = normalizeForexError(e, 'Order failed');
      setError(err);
      store.setLastError(err);
      return { ok: false as const, error: err };
    } finally {
      lock.current = false;
      setBusy(false);
      useForexStore.getState().setTicketBusy(false);
    }
  }, []);

  const cancel = useCallback(async (orderId: string) => {
    if (lock.current) return { ok: false as const, error: normalizeForexError({ code: 'BUSY', message: 'Busy' }) };
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await forexApi.cancelOrder(orderId);
      const u = unwrap(res);
      if (!u.ok) {
        setError(u.error);
        return { ok: false as const, error: u.error };
      }
      setLastOrder(u.data.order);
      await hydrateForexPrivate();
      setLastNote(`Cancelled ${orderId.slice(0, 8)}…`);
      return { ok: true as const, order: u.data.order };
    } catch (e) {
      const err = normalizeForexError(e, 'Cancel failed');
      setError(err);
      return { ok: false as const, error: err };
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  const modify = useCallback(async (orderId: string, patch: ForexModifyOrderBody) => {
    if (lock.current) return { ok: false as const, error: normalizeForexError({ code: 'BUSY', message: 'Busy' }) };
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      const res = await forexApi.modifyOrder(orderId, {
        ...patch,
        idempotencyKey: patch.idempotencyKey ?? `mod-${orderId.slice(0, 8)}-${Date.now()}`,
      });
      const u = unwrap(res);
      if (!u.ok) {
        setError(u.error);
        return { ok: false as const, error: u.error };
      }
      setLastOrder(u.data.order);
      await hydrateForexPrivate();
      setLastNote(`Modified ${orderId.slice(0, 8)}…`);
      return { ok: true as const, order: u.data.order };
    } catch (e) {
      const err = normalizeForexError(e, 'Modify failed');
      setError(err);
      return { ok: false as const, error: err };
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, lastOrder, lastNote, error, place, cancel, modify, isWorkingPending };
}
