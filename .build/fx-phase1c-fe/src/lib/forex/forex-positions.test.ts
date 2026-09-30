/**
 * Phase 10.5B targeted position / protection UI tests.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-positions.test.ts
 */
import {
  activeProtectionsFor,
  closeReferenceSide,
  closeSideForPosition,
  closeVolumeAllowed,
  fractionCloseVolume,
  interpretCloseError,
  isOpenPosition,
  missingCloseRoute,
  positionPanelStatus,
  positionUiStatus,
  positionUnrealizedPnl,
  protectionInputOk,
  protectionVolumeMismatch,
  shouldIgnoreStaleGeneration,
} from './models/position';
import type { ForexPublicPosition, ForexPublicProtection, ForexPnlView } from './models/types';
import { useForexStore } from './state/store';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function pos(over: Partial<ForexPublicPosition> = {}): ForexPublicPosition {
  return {
    positionId: 'p1',
    symbol: 'EURUSD',
    side: 'long',
    volume: '0.50',
    entryPrice: '1.10000',
    averageEntryPrice: '1.10000',
    currentPrice: '1.10500',
    contractSize: '100000',
    leverage: '100',
    initialMargin: '550',
    maintenanceMargin: '275',
    exposure: '55000',
    status: 'OPEN',
    mode: 'NETTING',
    version: 3,
    source: 'SIMULATED',
    valuationKind: 'CALCULATED',
    openedAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
    closedAt: null,
    ...over,
  };
}

function testNormalizeAndSides(): void {
  assert(isOpenPosition(pos()), 'open');
  assert(!isOpenPosition(pos({ status: 'CLOSED' })), 'closed not open');
  assert(closeSideForPosition('long') === 'sell', 'long close sell');
  assert(closeSideForPosition('short') === 'buy', 'short close buy');
  assert(closeReferenceSide('long') === 'BID', 'long bid');
  assert(closeReferenceSide('short') === 'ASK', 'short ask');
}

function testCloseVolume(): void {
  assert(closeVolumeAllowed('0.50', '0.50').ok, 'full');
  assert(closeVolumeAllowed('0.50', '0.25').ok, 'partial');
  assert(!closeVolumeAllowed('0.50', '0.75').ok, 'over');
  assert(!closeVolumeAllowed('0.50', '0').ok, 'zero');
  const over = closeVolumeAllowed('0.50', '1.00');
  assert(!over.ok && !over.ok && 'reason' in over && over.reason === 'CLOSE_VOLUME_EXCEEDS_POSITION', 'over reason');
  assert(fractionCloseVolume('0.50', 1) === '0.50', '100%');
  assert(fractionCloseVolume('0.50', 0.5) === '0.25', '50%');
}

function testPnlAuthority(): void {
  const missing = positionUnrealizedPnl(null, pos());
  assert(!missing.available, 'no pnl object');
  const stale: ForexPnlView = {
    realized: '0',
    unrealized: '0',
    total: '0',
    currency: 'USD',
    valuationTimestamp: '',
    priceSource: 'UNAVAILABLE',
    conversionSource: 'UNAVAILABLE',
    status: 'PRICE_UNAVAILABLE',
    source: 'SIMULATED',
    positions: [{ symbol: 'EURUSD', side: 'long', accountPnl: '0', calculationStatus: 'CALCULATED' }],
  };
  assert(!positionUnrealizedPnl(stale, pos()).available, 'status not calculated');
  const ok: ForexPnlView = {
    ...stale,
    status: 'CALCULATED',
    positions: [{ symbol: 'EURUSD', side: 'long', accountPnl: '12.5', currency: 'USD', calculationStatus: 'CALCULATED' }],
  };
  const shown = positionUnrealizedPnl(ok, pos());
  assert(shown.available && shown.value === '12.5', 'backend pnl');
}

function testCloseErrorMapping(): void {
  assert(missingCloseRoute({ code: 'NOT_FOUND', message: 'Route POST:/api/v1/forex/positions/x/close not found' }), '404');
  const mapped = interpretCloseError({ code: 'NOT_FOUND', message: 'Route POST:/api/v1/forex/positions/x/close not found' });
  assert(mapped.code === 'FOREX_CLOSE_UNAVAILABLE', 'mapped unavailable');
}

function testStates(): void {
  assert(positionUiStatus(pos(), true, false) === 'CLOSING', 'closing');
  assert(positionUiStatus(pos({ status: 'CLOSED' }), false, false) === 'CLOSED', 'closed confirmed');
  assert(positionUiStatus(pos(), false, false) === 'OPEN', 'open');
  assert(positionPanelStatus({ authed: false, hydratePhase: 'ready', hydrateError: null, socketState: 'CONNECTED', openCount: 0, lastHydratedAt: 1 }) === 'SIGNED_OUT', 'signed out');
  assert(positionPanelStatus({ authed: true, hydratePhase: 'hydrating', hydrateError: null, socketState: 'CONNECTED', openCount: 0, lastHydratedAt: null }) === 'LOADING', 'loading');
  assert(positionPanelStatus({ authed: true, hydratePhase: 'ready', hydrateError: null, socketState: 'CONNECTED', openCount: 0, lastHydratedAt: 1 }) === 'EMPTY', 'empty');
  assert(positionPanelStatus({ authed: true, hydratePhase: 'error', hydrateError: { code: 'X', message: 'm' }, socketState: 'CONNECTED', openCount: 0, lastHydratedAt: 1 }) === 'ERROR', 'error');
  assert(positionPanelStatus({ authed: true, hydratePhase: 'ready', hydrateError: null, socketState: 'DISCONNECTED', openCount: 1, lastHydratedAt: 1 }) === 'DISCONNECTED', 'disc');
}

function testProtectionAndRace(): void {
  assert(protectionInputOk('1.16000'), 'price ok');
  assert(!protectionInputOk(''), 'empty');
  const sl: ForexPublicProtection = {
    protectionId: 'sl1',
    clientProtectionId: 'c1',
    positionId: 'p1',
    symbol: 'EURUSD',
    positionSide: 'long',
    type: 'STOP_LOSS',
    volume: '0.50',
    triggerPrice: '1.09000',
    status: 'ACTIVE',
    lastEvalPrice: null,
    lastEvalSource: null,
    orderId: null,
    failureReason: null,
    source: 'SIMULATED',
  };
  const found = activeProtectionsFor({ sl1: sl }, 'p1');
  assert(found.sl?.protectionId === 'sl1', 'sl found');
  assert(found.tp === null, 'no tp');
  assert(shouldIgnoreStaleGeneration(2, 1), 'stale gen');
  assert(!shouldIgnoreStaleGeneration(2, 2), 'current gen');
}

function testWsDoesNotApplyOlderPosition(): void {
  useForexStore.setState({
    positions: { p1: pos({ version: 11, volume: '0.40' }) },
  });
  useForexStore.getState().applyWs({
    type: 'fx.position',
    data: { position: pos({ version: 10, volume: '0.50' }) },
  } as never);
  assert(useForexStore.getState().positions.p1.version === 11, 'older ws dropped');
  assert(useForexStore.getState().positions.p1.volume === '0.40', 'volume kept');
}

function testWsProtectionMerge(): void {
  useForexStore.setState({ protections: {} });
  useForexStore.getState().applyWs({
    type: 'fx.protection.triggered',
    data: {
      protection: {
        protectionId: 'pr1',
        clientProtectionId: 'c',
        positionId: 'p1',
        symbol: 'EURUSD',
        positionSide: 'long',
        type: 'STOP_LOSS',
        volume: '0.50',
        triggerPrice: '1.09',
        status: 'TRIGGERED',
        lastEvalPrice: '1.09',
        lastEvalSource: 'BID',
        orderId: null,
        failureReason: null,
        source: 'SIMULATED',
      },
    },
  } as never);
  assert(useForexStore.getState().protections.pr1.status === 'TRIGGERED', 'triggered merged');
}

function testProtectionVolumeDisclosure(): void {
  assert(!protectionVolumeMismatch('0.50', '0.50'), 'same volume');
  assert(protectionVolumeMismatch('0.25', '0.50'), 'original protection after partial close');
  assert(!protectionVolumeMismatch('0.50', undefined), 'missing volume not treated as mismatch');
}

testNormalizeAndSides();
testCloseVolume();
testProtectionVolumeDisclosure();
testPnlAuthority();
testCloseErrorMapping();
testStates();
testProtectionAndRace();
testWsDoesNotApplyOlderPosition();
testWsProtectionMerge();
console.log('forex-positions.test.ts ok');
