'use client';

import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';

/** Compatibility wrapper — Forex now uses the shared EDA product switcher. */
export function ForexProductSwitcher() {
  return <EdaProductSwitcher variant="terminal" />;
}
