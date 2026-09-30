'use client';

import { useCallback, useRef, useState } from 'react';
import { forexApi, unwrap } from '../api/client';
import { interpretCloseError } from '../models/position';
import { describeForexError, normalizeForexError } from '../models/errors';
import type { ForexError, ForexProtectionType, ForexPublicPosition } from '../models/types';
import { hydrateForexPrivate } from './hydrate';

function clientKey(prefix: string, positionId: string): string {
  const safe = positionId.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 12) || 'pos';
  return `${prefix}-${safe}-${Date.now()}`;
}

export function useForexPositionActions() {
  const [pendingClose, setPendingClose] = useState<Record<string, true>>({});
  const [pendingProtection, setPendingProtection] = useState<Record<string, true>>({});
  const [actionError, setActionError] = useState<ForexError | null>(null);
  const closeLock = useRef<Record<string, boolean>>({});
  const protGen = useRef(0);

  const rehydrate = useCallback(async () => {
    await hydrateForexPrivate();
  }, []);

  const closePosition = useCallback(async (position: ForexPublicPosition, volume: string) => {
    if (closeLock.current[position.positionId]) return;
    closeLock.current[position.positionId] = true;
    setPendingClose((s) => ({ ...s, [position.positionId]: true }));
    setActionError(null);
    try {
      const res = await forexApi.closePosition(position.positionId, {
        clientOrderId: clientKey('close', position.positionId),
        volume,
        expectedVersion: position.version,
      });
      const u = unwrap(res);
      if (!u.ok) {
        setActionError(interpretCloseError(u.error));
        await rehydrate();
        return;
      }
      await rehydrate();
    } catch (e) {
      setActionError(interpretCloseError(normalizeForexError(e, 'Close failed')));
      await rehydrate();
    } finally {
      closeLock.current[position.positionId] = false;
      setPendingClose((s) => {
        const next = { ...s };
        delete next[position.positionId];
        return next;
      });
    }
  }, [rehydrate]);

  const closeBy = useCallback(
    async (positionA: ForexPublicPosition, positionB: ForexPublicPosition, volume?: string) => {
      const lockKey = `cb:${positionA.positionId}:${positionB.positionId}`;
      if (closeLock.current[lockKey]) return;
      closeLock.current[lockKey] = true;
      setPendingClose((s) => ({ ...s, [positionA.positionId]: true, [positionB.positionId]: true }));
      setActionError(null);
      try {
        const res = await forexApi.closeBy({
          clientCloseById: clientKey('cb', `${positionA.positionId.slice(0, 6)}${positionB.positionId.slice(0, 6)}`),
          positionIdA: positionA.positionId,
          positionIdB: positionB.positionId,
          volume,
          expectedVersionA: positionA.version,
          expectedVersionB: positionB.version,
        });
        const u = unwrap(res);
        if (!u.ok) {
          setActionError(interpretCloseError(u.error));
        }
        await rehydrate();
      } catch (e) {
        setActionError(interpretCloseError(normalizeForexError(e, 'Close By failed')));
        await rehydrate();
      } finally {
        closeLock.current[lockKey] = false;
        setPendingClose((s) => {
          const next = { ...s };
          delete next[positionA.positionId];
          delete next[positionB.positionId];
          return next;
        });
      }
    },
    [rehydrate]
  );

  const reversePosition = useCallback(
    async (position: ForexPublicPosition) => {
      if (closeLock.current[position.positionId]) return;
      closeLock.current[position.positionId] = true;
      setPendingClose((s) => ({ ...s, [position.positionId]: true }));
      setActionError(null);
      try {
        const res = await forexApi.reversePosition(position.positionId, {
          clientReverseId: clientKey('rev', position.positionId),
          expectedVersion: position.version,
        });
        const u = unwrap(res);
        if (!u.ok) {
          setActionError(interpretCloseError(u.error));
        }
        await rehydrate();
      } catch (e) {
        setActionError(interpretCloseError(normalizeForexError(e, 'Reverse failed')));
        await rehydrate();
      } finally {
        closeLock.current[position.positionId] = false;
        setPendingClose((s) => {
          const next = { ...s };
          delete next[position.positionId];
          return next;
        });
      }
    },
    [rehydrate]
  );

  const createProtection = useCallback(
    async (
      position: ForexPublicPosition,
      type: ForexProtectionType,
      triggerPrice: string
    ): Promise<boolean> => {
      const key = `${position.positionId}:${type}`;
      const gen = ++protGen.current;
      setPendingProtection((s) => ({ ...s, [key]: true }));
      setActionError(null);
      try {
        const res = await forexApi.createProtection({
          clientProtectionId: clientKey(type === 'STOP_LOSS' ? 'sl' : 'tp', position.positionId),
          positionId: position.positionId,
          type,
          triggerPrice: triggerPrice.trim(),
        });
        if (gen !== protGen.current) return false;
        const u = unwrap(res);
        if (!u.ok) {
          setActionError({ ...u.error, message: describeForexError(u.error) });
        }
        await rehydrate();
        return u.ok;
      } catch (e) {
        if (gen !== protGen.current) return false;
        setActionError(normalizeForexError(e, 'Protection create failed'));
        await rehydrate();
        return false;
      } finally {
        if (gen === protGen.current) {
          setPendingProtection((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
        }
      }
    },
    [rehydrate]
  );

  const removeProtection = useCallback(
    async (protectionId: string, positionId: string, type: ForexProtectionType) => {
      const key = `${positionId}:${type}`;
      const gen = ++protGen.current;
      setPendingProtection((s) => ({ ...s, [key]: true }));
      setActionError(null);
      try {
        const res = await forexApi.cancelProtection(protectionId);
        if (gen !== protGen.current) return;
        const u = unwrap(res);
        if (!u.ok) {
          setActionError({ ...u.error, message: describeForexError(u.error) });
        }
        await rehydrate();
      } catch (e) {
        if (gen !== protGen.current) return;
        setActionError(normalizeForexError(e, 'Protection cancel failed'));
        await rehydrate();
      } finally {
        if (gen === protGen.current) {
          setPendingProtection((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
        }
      }
    },
    [rehydrate]
  );

  const setTrailing = useCallback(
    async (position: ForexPublicPosition, distance: string | null, existingSlId?: string | null) => {
      const key = `${position.positionId}:STOP_LOSS`;
      const gen = ++protGen.current;
      setPendingProtection((s) => ({ ...s, [key]: true }));
      setActionError(null);
      try {
        if (distance == null || !distance.trim()) {
          if (existingSlId) {
            const res = await forexApi.updateProtection(existingSlId, { trailingDistance: null });
            const u = unwrap(res);
            if (!u.ok) setActionError({ ...u.error, message: describeForexError(u.error) });
          }
          await rehydrate();
          return;
        }
        const quote = (await import('../state/store')).useForexStore.getState().quotes[position.symbol];
        const mark = position.side === 'long' ? quote?.bid : quote?.ask;
        if (existingSlId) {
          const res = await forexApi.updateProtection(existingSlId, { trailingDistance: distance.trim() });
          const u = unwrap(res);
          if (!u.ok) setActionError({ ...u.error, message: describeForexError(u.error) });
        } else if (mark) {
          const dist = Number(distance);
          const base = Number(mark);
          const trigger =
            position.side === 'long' ? String(base - dist) : String(base + dist);
          const res = await forexApi.createProtection({
            clientProtectionId: clientKey('trail', position.positionId),
            positionId: position.positionId,
            type: 'STOP_LOSS',
            triggerPrice: trigger,
            trailingDistance: distance.trim(),
          });
          const u = unwrap(res);
          if (!u.ok) setActionError({ ...u.error, message: describeForexError(u.error) });
        } else {
          setActionError({ code: 'PRICE_UNAVAILABLE', message: 'Quote unavailable for trailing stop' });
        }
        if (gen !== protGen.current) return;
        await rehydrate();
      } catch (e) {
        if (gen !== protGen.current) return;
        setActionError(normalizeForexError(e, 'Trailing stop failed'));
        await rehydrate();
      } finally {
        if (gen === protGen.current) {
          setPendingProtection((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
        }
      }
    },
    [rehydrate]
  );

  const updateProtection = useCallback(
    async (
      position: ForexPublicPosition,
      type: ForexProtectionType,
      existingId: string | null,
      triggerPrice: string
    ): Promise<boolean> => {
      const key = `${position.positionId}:${type}`;
      const gen = ++protGen.current;
      setPendingProtection((s) => ({ ...s, [key]: true }));
      setActionError(null);
      try {
        if (existingId) {
          const del = await forexApi.cancelProtection(existingId);
          const du = unwrap(del);
          if (!du.ok) {
            if (gen === protGen.current) {
              setActionError({ ...du.error, message: describeForexError(du.error) });
            }
            await rehydrate();
            return false;
          }
        }
        const created = await forexApi.createProtection({
          clientProtectionId: clientKey(type === 'STOP_LOSS' ? 'sl' : 'tp', position.positionId),
          positionId: position.positionId,
          type,
          triggerPrice: triggerPrice.trim(),
        });
        if (gen !== protGen.current) {
          await rehydrate();
          return false;
        }
        const cu = unwrap(created);
        if (!cu.ok) {
          setActionError({
            code: cu.error.code,
            message: `${type === 'STOP_LOSS' ? 'SL' : 'TP'} update failed. ${describeForexError(cu.error)}`,
          });
        }
        await rehydrate();
        return cu.ok;
      } catch (e) {
        if (gen !== protGen.current) return false;
        setActionError(normalizeForexError(e, 'Protection update failed'));
        await rehydrate();
        return false;
      } finally {
        if (gen === protGen.current) {
          setPendingProtection((s) => {
            const next = { ...s };
            delete next[key];
            return next;
          });
        }
      }
    },
    [rehydrate]
  );

  return {
    pendingClose,
    pendingProtection,
    actionError,
    closePosition,
    closeBy,
    reversePosition,
    createProtection,
    removeProtection,
    updateProtection,
    setTrailing,
    rehydrate,
  };
}
