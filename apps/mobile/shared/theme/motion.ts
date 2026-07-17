/** Animation timing aligned with apps/frontend tailwind.config.ts and MOB-001B motion */
export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
    overlayIn: 200,
    overlayOut: 150,
    sheetIn: 280,
    sheetOut: 220,
    dialogIn: 180,
    dialogOut: 120,
    dialogZoom: 220,
    skeletonPulse: 1400,
  },
  easing: {
    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
    easeOut: 'ease-out',
  },
} as const;
