import { FOREX_PROVIDER_IDS } from '../instruments.catalog.js';
import { lpPlugArmed } from '../lp/lp-api-client.js';
import { LpExecutionVenue } from '../lp/lp-venue.js';
import { MockForexExecutionVenue } from './mock-venue.js';
import type { ForexExecutionVenue } from './venue.js';

export function createMockExecutionVenues(): Map<string, ForexExecutionVenue> {
  const map = new Map<string, ForexExecutionVenue>();
  const a = new MockForexExecutionVenue('MOCK-A', 'EDA Mock Execution A', FOREX_PROVIDER_IDS.MOCK_A);
  const b = new MockForexExecutionVenue('MOCK-B', 'EDA Mock Execution B', FOREX_PROVIDER_IDS.MOCK_B);
  const c = new MockForexExecutionVenue('MOCK-C', 'EDA Mock Execution C', FOREX_PROVIDER_IDS.MOCK_C);
  map.set('MOCK-A', a);
  map.set('MOCK-B', b);
  map.set('MOCK-C', c);
  if (lpPlugArmed()) map.set('LP-1', new LpExecutionVenue());
  return map;
}

export function asMock(venue: ForexExecutionVenue | undefined): MockForexExecutionVenue | undefined {
  return venue instanceof MockForexExecutionVenue ? venue : undefined;
}
