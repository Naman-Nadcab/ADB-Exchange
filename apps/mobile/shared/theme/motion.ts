/** Animation timing aligned with apps/frontend tailwind.config.ts */
export const motion = {
  duration: {
    fast: 150,
    normal: 250,
    slow: 400,
  },
  easing: {
    standard: 'cubic-bezier(0.22, 1, 0.36, 1)',
    easeOut: 'ease-out',
  },
} as const;
