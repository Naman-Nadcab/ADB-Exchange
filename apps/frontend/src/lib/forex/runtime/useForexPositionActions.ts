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

  const createProtection = useCallback(
    async (position: ForexPublicPosition, type: ForexProtectionType, triggerPrice: string) => {
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
        if (gen !== protGen.current) return;
        const u = unwrap(res);
        if (!u.ok) {
          setActionError({ ...u.error, message: describeForexError(u.error) });
        }
        await rehydrate();
      } catch (e) {
        if (gen !== protGen.current) return;
        setActionError(normalizeForexError(e, 'Protection create failed'));
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

  const updateProtection = useCallback(
    async (
      position: ForexPublicPosition,
      type: ForexProtectionType,
      existingId: string | null,
      triggerPrice: string
    ) => {
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
            return;
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
          return;
        }
        const cu = unwrap(created);
        if (!cu.ok) {
          setActionError({
            code: cu.error.code,
            message: `${type === 'STOP_LOSS' ? 'SL' : 'TP'} update failed. ${describeForexError(cu.error)}`,
          });
        }
        await rehydrate();
      } catch (e) {
        if (gen !== protGen.current) return;
        setActionError(normalizeForexError(e, 'Protection update failed'));
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

  return {
    pendingClose,
    pendingProtection,
    actionError,
    closePosition,
    createProtection,
    removeProtection,
    updateProtection,
    rehydrate,
  };
}
