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
  assert(bottom.includes('customerJournalLine'), 'journal speaks in sentences');
  assert(bottom.includes('buildAlertCreateBody'), 'alerts can be created from the tab');
  assert(!bottom.includes('ForexServerAlertsPanel'), 'the dock alerts tab is not the alert form');
  assert(!bottom.includes("id: 'signals'"), 'signals shop is not a tab');
}

function testMobileTicket(): void {
  const layout = readFileSync(join(root, 'ForexTerminalLayout.tsx'), 'utf8');
  const tradePage = readFileSync(join(__dirname, '../../app/forex/page.tsx'), 'utf8');
  assert(layout.includes('overflow-x-hidden'), 'no page overflow');
  assert(tradePage.includes('ForexOrderTicket'), 'mobile companion owns order ticket');
  assert(!/lg:hidden[\s\S]*<ForexOrderTicket/.test(layout), 'layout must not duplicate mobile ticket');
  assert(layout.includes('ForexPhoneTabBar'), 'phones use a full-screen terminal bar');
  assert(layout.includes("phoneScreen !== 'chart' && 'max-md:hidden'"), 'a phone screen other than the chart hides the chart column');
  assert(tradePage.includes("screen === 'trade'"), 'the phone trade screen is the order ticket');
  assert(tradePage.includes("screen === 'book'"), 'phone positions and history use the toolbox');
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
  assert(positions.includes('accountUnrealizedPnl'), 'one open ticket uses the account profit');
  assert(positions.includes('data-trade-strip'), 'trade actions sit on the selected ticket');
  assert(positions.includes('tradeActionStripAbove'), 'a ticket with no room below opens its strip above');
  assert(!positions.includes('max-h-[58%]'), 'trade actions are not a separate dock block');
  assert(positions.includes('function closeFull'), 'the row close mark closes the full ticket');
  assert(positions.includes('actions.closePosition(p, p.volume)'), 'the row close mark sends the full volume');
  assert(!positions.includes("tp('menuViewChart')"), 'chart is already on screen');
  assert(!positions.includes("tp('menuHistory')"), 'history is already a tab');
  assert(!positions.includes("tp('dismiss')"), 'the menu closes without a dismiss row');
  assert(positions.includes('whitespace-nowrap'), 'a trade strip stays one row');
  assert(positions.includes('text-sell'), 'close and sell use the sell color');
  assert(positions.includes('text-buy'), 'buy and profit use the buy color');
  assert(positions.includes('formatForexPair'), 'trade symbols use the market watch pair label');
  assert(positions.includes('modifyTrail'), 'modify dialog includes the trailing stop');
  const ticket = readFileSync(join(root, 'ForexOrderTicket.tsx'), 'utf8');
  assert(ticket.includes('estimateTicketRisk'), 'ticket risk estimates');
  assert(!ticket.includes('ticketPanel.tif'), 'order ticket hides time in force');
  assert(!ticket.includes('ticketPanel.free'), 'order ticket hides the free-margin box');
  assert(ticket.includes('timeInForce: tifUnsupported'), 'orders still send good-till-cancelled');
  assert(ticket.includes("tf('ticketPanel.kind')"), 'order type keeps the Type label');
  assert(!ticket.includes("preview.status === 'LOADING'"), 'a slow preview does not disable buy and sell');
  assert(ticket.includes('setTicketVolume'), 'ticket volume is shared with chart one-click');
  assert(ticket.includes('suggestedProtectionPrice'), 'stop and take profit show a suggested price');
  const engine = readFileSync(join(__dirname, 'runtime/useForexOrderEngine.ts'), 'utf8');
  assert(engine.includes('filledPositionForOrder'), 'stop loss lands on the filled ticket');
  assert(engine.includes('activeProtectionsFor'), 'a protection the server already saved is not sent twice');
  const chart = readFileSync(join(root, 'ForexChartFoundation.tsx'), 'utf8');
  assert(chart.includes('ticketVolume'), 'chart one-click uses the ticket lot');
  assert(chart.includes("commitProtectionDrag('STOP_LOSS'"), 'chart stop loss uses the focused ticket');
  const watch = readFileSync(join(root, 'ForexWatchlist.tsx'), 'utf8');
  assert(watch.includes('menuRef'), 'market watch menu stays on screen');
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  const history = bottom.slice(bottom.indexOf('function HistoryPanel'), bottom.indexOf('function ExposurePanel'));
  assert(history.includes('bottomPanels.history.periodAria'), 'history period is a labelled dropdown');
  assert(history.includes('fx-dock-toolbar'), 'history period shares the export row');
  assert(!history.includes('<PeriodBar'), 'history does not spend a row on period chips');
  assert(bottom.includes("id: 'analytics'"), 'risk analytics tab');
  assert(bottom.includes("id: 'alerts'"), 'alerts tab');
  assert(bottom.includes('postedFeeByFill'), 'history commission comes from posted fees');
  assert(bottom.includes('alertEvents'), 'mailbox reads alert events');
  assert(bottom.includes('removeLocal'), 'terminal alerts can delete a chart alert');
  const panel = bottom.slice(bottom.indexOf('role="tabpanel"'), bottom.indexOf('fx-dock-tabs'));
  const newsAt = panel.indexOf("tab === 'news'");
  const authAt = panel.indexOf('!authed');
  assert(newsAt >= 0 && authAt > newsAt, 'news and calendar open without a sign-in wall');
}

function testPendingCancelSurfaces(): void {
  const bottom = readFileSync(join(root, 'ForexBottomPanels.tsx'), 'utf8');
  assert(bottom.includes('Cancel'), 'toolbox Orders Cancel');
  assert(bottom.includes('sticky left-0'), 'Cancel sticky discoverable');
  assert(bottom.includes('data-testid={`cancel-order-'), 'Cancel test id');
  const tradePage = readFileSync(join(__dirname, '../../app/forex/page.tsx'), 'utf8');
  assert(tradePage.includes('compact={false}'), 'mobile Trade tab keeps the position list open');
  assert(tradePage.includes('ForexBottomPanels'), 'mobile toolbox exposes Cancel surfaces');
  const ordersPage = readFileSync(join(__dirname, '../../app/forex/orders/page.tsx'), 'utf8');
  assert(ordersPage.includes('Cancel'), 'Orders page Cancel');
  assert(ordersPage.includes('useForexOrderEngine'), 'Orders page uses order engine');
  assert(ordersPage.includes("to('modify')"), 'Orders page Modify');
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
