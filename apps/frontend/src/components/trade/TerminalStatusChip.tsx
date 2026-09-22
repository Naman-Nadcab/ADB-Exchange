'use client';

import type { SpotWsStreamPhase } from '@/hooks/useSpotWs';

type ChipTone = 'live' | 'sync' | 'warn' | 'off' | 'neutral';

const TONE_CLASS: Record<ChipTone, string> = {
  live: 'terminal-status-chip--live',
  sync: 'terminal-status-chip--sync',
  warn: 'terminal-status-chip--warn',
  off: 'terminal-status-chip--off',
  neutral: 'terminal-status-chip--neutral',
};

export function TerminalStatusChip({
  label,
  tone = 'neutral',
  title,
  pulse = false,
}: {
  label: string;
  tone?: ChipTone;
  title?: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`terminal-status-chip ${TONE_CLASS[tone]}`}
      title={title}
    >
      <span
        className={`terminal-status-chip__dot ${pulse ? 'terminal-status-chip__dot--pulse' : ''}`}
        aria-hidden
      />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function streamPhaseToChip(
  phase: SpotWsStreamPhase,
  t: (key: string) => string
): { label: string; tone: ChipTone; pulse: boolean } {
  switch (phase) {
    case 'live':
      return { label: t('chart.phase.live'), tone: 'live', pulse: false };
    case 'reconnecting':
      return { label: t('chart.phase.reconnecting'), tone: 'sync', pulse: true };
    case 'connecting':
      return { label: t('chart.phase.connecting'), tone: 'sync', pulse: true };
    case 'disconnected':
      return { label: t('chart.phase.disconnected'), tone: 'off', pulse: false };
    default:
      return { label: '—', tone: 'neutral', pulse: false };
  }
}
