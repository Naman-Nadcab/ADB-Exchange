'use client';

import { EdaProductSwitcher } from '@/components/eda/EdaProductSwitcher';

/** Compatibility wrapper — Forex uses the shared product switcher. */
export function ForexProductSwitcher() {
  return <EdaProductSwitcher variant="terminal" />;
}
