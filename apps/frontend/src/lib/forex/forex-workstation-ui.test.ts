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

function testLeftStackKeepsHeight(): void {
  const layout = readFileSync(join(root, 'ForexTerminalLayout.tsx'), 'utf8');
  const chartAt = layout.indexOf('<ForexChartWorkspace');
  const bottomAt = layout.indexOf('<ForexBottomPanels');
  assert(chartAt > 0 && bottomAt > chartAt, 'terminal dock follows the chart');
  assert(layout.includes('Chart-column terminal dock'), 'dock stays under the chart');
  assert(layout.includes('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'), 'chart fills the space above the dock');
  const menuAt = layout.lastIndexOf('<ForexAppToolbar />');
  const watchAt = layout.indexOf('<ForexWatchlist />');
  assert(menuAt > 0 && menuAt < watchAt && watchAt < chartAt, 'menu bar sits above Market Watch, beside the chart');
  assert(!layout.includes('Full-width terminal dock'), 'dock does not run under Market Watch');
  assert(!layout.includes('ForexAccountBar'), 'account bar is not on the terminal');
  const chart = readFileSync(join(root, 'ForexChartFoundation.tsx'), 'utf8');
  const chrome = readFileSync(join(root, 'mt5-chart/ForexMt5ChartChrome.tsx'), 'utf8');
  assert(!chart.includes('ForexMt5DataWindow'), 'data window is not on the chart');
  assert(!chrome.includes('ohlcLine'), 'toolbar does not repeat bar prices');
  assert(!chrome.includes("t('bid')"), 'chart header does not repeat bid');
  assert(!chrome.includes("t('ask')"), 'chart header does not repeat ask');
  assert(!layout.includes('!authed && !hasTradingData'), 'guest visits do not collapse the dock');
  assert(!layout.includes('min(420px, 48%)'), 'order ticket is not forced to half the column');
  assert(!layout.includes('lg:max-h-[min(420px,46%)]'), 'order ticket sits against Market Watch');
  assert(layout.includes('fx-watch-slot'), 'market watch sizes to its rows');
  const settings = readFileSync(join(root, 'ForexAccountSettingsPanel.tsx'), 'utf8');
  assert(!settings.includes('ForexPositionModeSwitch'), 'customer settings do not offer a position-mode switch');
  const accounts = readFileSync(join(__dirname, '../../../../backend/src/services/forex/customer/accounts-service.ts'), 'utf8');
  assert(accounts.includes("'HEDGING', 'DEMO'"), 'new demo accounts open in hedging');
  assert(!accounts.includes("'NETTING', 'DEMO'"), 'new demo accounts are not netting');
  const priceChart = readFileSync(join(root, 'ForexLightweightChart.tsx'), 'utf8');
  assert(!priceChart.includes("'ASK'") && !priceChart.includes("'BID'"), 'chart does not tag bid or ask');
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  const panelAt = bottom.indexOf('role="tabpanel"');
  const tabsAt = bottom.indexOf('role="tablist"');
  assert(panelAt > 0 && tabsAt > panelAt, 'tabs sit under the table');
  assert(!bottom.includes('TerminalAccountLine'), 'account line is not in the dock');
  const positionsSrc = readFileSync(join(root, 'ForexPositionPanel.tsx'), 'utf8');
  for (const key of ['colOrder', 'colTime', 'colType', 'colSize', 'colPrice', 'colSl', 'colTp', 'colCommission', 'colTaxes', 'colSwap', 'colProfit']) {
    assert(positionsSrc.includes(`tp('${key}')`), `trade table has ${key}`);
  }
  assert(!bottom.includes("t.id === 'positions' || t.id === 'orders') setBottomCollapsed"), 'switching tabs does not resize the dock');
  const watch = readFileSync(join(root, 'ForexWatchlist.tsx'), 'utf8');
  assert(!watch.includes('footerSession'), 'session line does not sit under the pairs');
  assert(watch.includes('<ForexSymbolSearch'), 'pair search stays on market watch');
  const search = readFileSync(join(root, 'ForexSymbolSearch.tsx'), 'utf8');
  assert(!search.includes('h-8 w-full'), 'search is not a full-width box');
  assert(bottom.includes("mk('colAsset')"), 'exposure tab is a currency table');
  assert(bottom.includes("mk('profitLoss')"), 'account history has the MT4 summary');
  assert(bottom.includes('bottomPanels.mt4.colHeadline'), 'news is a headline table');
  assert(bottom.includes('bottomPanels.mt4.colFrom'), 'mailbox has a from column');
  assert(bottom.includes("mk('colCondition')"), 'alerts tab is a condition table');
  assert(bottom.includes("mk('colPrevious')"), 'calendar has previous/forecast/actual');
  assert(bottom.includes('bottomPanels.mt4.colMessage'), 'journal is time and message');
  assert(!bottom.includes('ForexServerAlertsPanel'), 'the dock alerts tab is not the alert form');
  assert(!bottom.includes("id: 'signals'"), 'signals shop is not a tab');
}

function testMobileTicket(): void {
  const layout = readFileSync(join(root, 'ForexTerminalLayout.tsx'), 'utf8');
  const tradePage = readFileSync(join(__dirname, '../../app/forex/page.tsx'), 'utf8');
  assert(layout.includes('overflow-x-hidden'), 'no page overflow');
  assert(tradePage.includes('ForexOrderTicket'), 'mobile companion owns order ticket');
  assert(!/lg:hidden[\s\S]*<ForexOrderTicket/.test(layout), 'layout must not duplicate mobile ticket');
}

function testChartAlwaysUsesQuote(): void {
  const foundation = readFileSync(join(root, 'ForexChartFoundation.tsx'), 'utf8');
  assert(foundation.includes('liveBid'), 'live quote bid');
  assert(foundation.includes('quoteDemoSimulated'), 'honest chart status');
}

function testP0Surfaces(): void {
  const positions = readFileSync(join(root, 'ForexPositionPanel.tsx'), 'utf8');
  assert(positions.includes('livePositionValuation'), 'live quote P&L');
  assert(positions.includes('onTrailSet'), 'trailing control');
  assert(positions.includes('menuModify'), 'trade rows can modify stop loss and take profit');
  assert(positions.includes('modifyTrail'), 'modify dialog includes the trailing stop');
  const ticket = readFileSync(join(root, 'ForexOrderTicket.tsx'), 'utf8');
  assert(ticket.includes('estimateTicketRisk'), 'ticket risk estimates');
  assert(!ticket.includes('ticketPanel.tif'), 'order ticket hides time in force');
  assert(!ticket.includes('ticketPanel.free'), 'order ticket hides the free-margin box');
  assert(ticket.includes('timeInForce: tifUnsupported'), 'orders still send good-till-cancelled');
  assert(ticket.includes("tf('ticketPanel.kind')"), 'order type keeps the Type label');
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  const history = bottom.slice(bottom.indexOf('function HistoryPanel'), bottom.indexOf('function ExposurePanel'));
  assert(history.includes('bottomPanels.history.periodAria'), 'history period is a labelled dropdown');
  assert(history.includes('fx-dock-toolbar'), 'history period shares the export row');
  assert(!history.includes('<PeriodBar'), 'history does not spend a row on period chips');
  assert(bottom.includes("id: 'analytics'"), 'risk analytics tab');
  assert(bottom.includes("id: 'alerts'"), 'alerts tab');
}

function testPendingCancelSurfaces(): void {
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  assert(bottom.includes('Cancel'), 'toolbox Orders Cancel');
  assert(bottom.includes('sticky left-0'), 'Cancel sticky discoverable');
  assert(bottom.includes('data-testid={`cancel-order-'), 'Cancel test id');
  const tradePage = readFileSync(join(__dirname, '../../app/forex/page.tsx'), 'utf8');
  assert(tradePage.includes('compact={bottomCollapsed}'), 'mobile toolbox respects workspace collapse');
  assert(tradePage.includes('ForexBottomPanels'), 'mobile toolbox exposes Cancel surfaces');
  const ordersPage = readFileSync(join(__dirname, '../../app/forex/orders/page.tsx'), 'utf8');
  assert(ordersPage.includes('Cancel'), 'Orders page Cancel');
  assert(ordersPage.includes('useForexOrderEngine'), 'Orders page uses order engine');
  assert(ordersPage.includes('Modify'), 'Orders page Modify');
}

testLeftStackKeepsHeight();
testNoBareLiveLabel();
testNoLastAsCurrent();
testEngineUuid();
testMobileTicket();
testChartAlwaysUsesQuote();
testP0Surfaces();
testPendingCancelSurfaces();
console.log('forex-workstation-ui.test.ts ok');
