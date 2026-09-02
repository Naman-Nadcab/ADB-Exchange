'use client';

import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';

/** Compatibility wrapper — Forex now uses the shared FDM product switcher. */
export function ForexProductSwitcher() {
  return <EdaProductSwitcher variant="terminal" />;
}
