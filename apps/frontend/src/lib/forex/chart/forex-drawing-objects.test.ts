/**
 * Drawing object list helpers (object manager wiring).
 * Run: npx tsx apps/frontend/src/lib/forex/chart/forex-drawing-objects.test.ts
 */
import assert from 'node:assert/strict';
import type { ForexDrawingObjectRef } from '../../../components/forex/ForexLightweightChart.js';

function objectRowsFromApi(list: ForexDrawingObjectRef[]) {
  return list.map((o) => ({ ...o, key: `${o.layer}:${o.id}` }));
}

const sample: ForexDrawingObjectRef[] = [
  { id: 'a1', layer: 'native', kind: 'hline', label: 'H-Line', hidden: false, locked: false },
  { id: 'b2', layer: 'extra', kind: 'rect', label: 'Rectangle', hidden: true, locked: false },
];

const rows = objectRowsFromApi(sample);
assert.equal(rows.length, 2);
assert.equal(rows[0]!.key, 'native:a1');
assert.equal(rows[1]!.key, 'extra:b2');
assert.equal(rows[1]!.hidden, true);

console.log('forex-drawing-objects.test.ts ok');
