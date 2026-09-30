/**
 * Source-level workstation invariants.
 * Run: npx tsx apps/frontend/src/lib/forex/forex-workstation-ui.test.ts
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const root = join(__dirname, '../../components/forex');

function testNoBareLiveLabel(): void {
  const src = readFileSync(join(root, 'ForexConnectionStatus.tsx'), 'utf8');
  assert(!src.includes("CONNECTED: 'Live'"), 'must not label DEMO feed as Live');
  assert(src.includes('FOREX_PRODUCT.statusConnected') || src.includes('DEMO'), 'honest demo status');
}

function testNoLastAsCurrent(): void {
  const chart = readFileSync(join(root, 'ForexLightweightChart.tsx'), 'utf8');
  assert(!chart.includes("'LAST'"), 'do not label historical close as LAST');
  assert(chart.includes("'CLOSE'"), 'historical close labelled CLOSE');
}

function testEngineUuid(): void {
  const engine = readFileSync(join(__dirname, 'runtime/useForexOrderEngine.ts'), 'utf8');
  assert(engine.includes('generateClientOrderId'), 'uses helper');
  assert(!engine.includes('crypto.randomUUID()'), 'no direct randomUUID');
}

function testMobileTicket(): void {
  const layout = readFileSync(join(root, 'ForexTerminalLayout.tsx'), 'utf8');
  assert(layout.includes('overflow-x-hidden'), 'no page overflow');
  assert(layout.includes('lg:hidden'), 'mobile ticket/toolbox path');
}

function testChartAlwaysUsesQuote(): void {
  const foundation = readFileSync(join(root, 'ForexChartFoundation.tsx'), 'utf8');
  assert(foundation.includes('liveBid'), 'live quote bid');
  assert(foundation.includes('DEMO · SIMULATED'), 'honest chart status');
}

function testP0Surfaces(): void {
  const positions = readFileSync(join(root, 'ForexPositionPanel.tsx'), 'utf8');
  assert(positions.includes('livePositionValuation'), 'live quote P&L');
  assert(positions.includes('onTrailSet'), 'trailing control');
  const ticket = readFileSync(join(root, 'ForexOrderTicket.tsx'), 'utf8');
  assert(ticket.includes('estimateTicketRisk'), 'ticket risk estimates');
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  assert(bottom.includes("id: 'analytics'"), 'risk analytics tab');
  assert(bottom.includes("id: 'alerts'"), 'alerts tab');
}

function testPendingCancelSurfaces(): void {
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  assert(bottom.includes('Cancel'), 'toolbox Orders Cancel');
  assert(bottom.includes('sticky left-0'), 'Cancel sticky discoverable');
  assert(bottom.includes('data-testid={`cancel-order-'), 'Cancel test id');
  const layout = readFileSync(join(root, 'ForexTerminalLayout.tsx'), 'utf8');
  assert(layout.includes('compact={bottomCollapsed}'), 'mobile must not hardcode compact');
  assert(!layout.includes('<ForexBottomPanels compact '), 'no forced compact that hides Cancel');
  const ordersPage = readFileSync(join(__dirname, '../../app/forex/orders/page.tsx'), 'utf8');
  assert(ordersPage.includes('Cancel'), 'Orders page Cancel');
  assert(ordersPage.includes('useForexOrderEngine'), 'Orders page uses order engine');
  assert(ordersPage.includes('Modify'), 'Orders page Modify');
}

testNoBareLiveLabel();
testNoLastAsCurrent();
testEngineUuid();
testMobileTicket();
testChartAlwaysUsesQuote();
testP0Surfaces();
testPendingCancelSurfaces();
console.log('forex-workstation-ui.test.ts ok');
