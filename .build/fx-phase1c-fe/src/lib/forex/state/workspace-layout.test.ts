/**
 * Run: npx tsx apps/frontend/src/lib/forex/state/workspace-layout.test.ts
 */
import { FOREX_BOTTOM_COMPACT_H, FOREX_BOTTOM_EXPANDED_MIN, resolveForexBottomHeight } from './workspace';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function testCollapsedDefault(): void {
  const h = resolveForexBottomHeight({
    chartMode: 'normal',
    bottomCollapsed: true,
    preferredHeight: 220,
  });
  assert(h === FOREX_BOTTOM_COMPACT_H, 'collapsed stays compact');
}

function testUserExpanded(): void {
  const h = resolveForexBottomHeight({
    chartMode: 'normal',
    bottomCollapsed: false,
    preferredHeight: 168,
  });
  assert(h === 168, 'expanded uses preferred height');
  assert(h >= FOREX_BOTTOM_EXPANDED_MIN, 'above min');
}

function testExpandMode(): void {
  assert(
    resolveForexBottomHeight({
      chartMode: 'expand',
      bottomCollapsed: false,
      preferredHeight: 220,
    }) === FOREX_BOTTOM_COMPACT_H,
    'expand keeps compact bottom strip'
  );
  assert(
    resolveForexBottomHeight({
      chartMode: 'fullscreen',
      bottomCollapsed: false,
      preferredHeight: 220,
    }) === 0,
    'fullscreen hides bottom'
  );
}

testCollapsedDefault();
testUserExpanded();
testExpandMode();
console.log('workspace-layout.test.ts ok');
