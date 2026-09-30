#!/usr/bin/env node
/**
 * In-process S5 checks — run inside the backend container (no admin HTTP login).
 *
 *   docker exec exchange-backend node /opt/m-live/scripts/forex-s5-staging-cert-internal.mjs
 */
import { pathToFileURL } from 'node:url';

const DIST = process.env.BACKEND_DIST?.trim() || '/app/dist';

function mark(results, name, ok, detail = '') {
  results.push({ name, ok: Boolean(ok), detail });
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

async function imp(rel) {
  return import(pathToFileURL(`${DIST}/${rel}`).href);
}

async function main() {
  console.log('\nForex S5 internal cert (in-process)\n');
  const RESULTS = [];

  const { forexReadinessSnapshot } = await imp('services/forex/durability/ready.js');
  const { forexConfig } = await imp('services/forex/config.js');
  const { buildForexAdminRoutingDeskSnapshot } = await imp('services/forex/admin/routing-desk.js');
  const { effectiveForexRuntimeFlags } = await imp('services/forex/admin/runtime-controls.js');

  const ready = forexReadinessSnapshot();
  mark(RESULTS, 'ECONOMIC_READY', ready.economicReady === true, ready.reason ?? '');
  mark(RESULTS, 'FLAG_ROUTING_V2', forexConfig.routingV2Enabled === true, String(forexConfig.routingV2Enabled));
  mark(RESULTS, 'FLAG_ADAPTER_HOOK', forexConfig.adapterLayerHookEnabled === true, String(forexConfig.adapterLayerHookEnabled));
  mark(RESULTS, 'KILL_SWITCH_OFF', !effectiveForexRuntimeFlags().killSwitch, '');

  const desk = await buildForexAdminRoutingDeskSnapshot();
  for (const row of desk.stagingChecklist) {
    mark(RESULTS, `CHECKLIST_${row.id.toUpperCase().replace(/-/g, '_')}`, row.pass, row.detail);
  }

  if (effectiveForexRuntimeFlags().executionTestApiEnabled) {
    const { getForexExecutionService } = await imp('services/forex/execution/service.js');
    const { getForexPricingService } = await imp('services/forex/quotes.service.js');
    const exec = getForexExecutionService(getForexPricingService());
    try {
      const rec = await exec.execute({
        clientExecId: `internal-s5-${Date.now()}`,
        symbol: 'EURUSD',
        side: 'buy',
        volume: '0.01',
        orderType: 'market',
        timestamp: new Date().toISOString(),
      });
      mark(RESULTS, 'EXEC_TEST_ORDER', rec.status === 'FILLED' || rec.status === 'PARTIALLY_FILLED', rec.status);
    } catch (e) {
      mark(RESULTS, 'EXEC_TEST_ORDER', false, e instanceof Error ? e.message : String(e));
    }
  } else {
    mark(RESULTS, 'EXEC_TEST_API_ENABLED', false, 'FOREX_EXECUTION_TEST_API off');
  }

  const failed = RESULTS.filter((r) => !r.ok);
  console.log(`\nS5 internal: ${failed.length === 0 ? 'PASS' : 'FAIL'} (${RESULTS.length - failed.length}/${RESULTS.length})`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
