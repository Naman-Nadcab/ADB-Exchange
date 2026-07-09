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

export function streamPhaseToChip(phase: SpotWsStreamPhase): { label: string; tone: ChipTone; pulse: boolean } {
  switch (phase) {
    case 'live':
      return { label: 'Live', tone: 'live', pulse: false };
    case 'reconnecting':
      return { label: 'Syncing', tone: 'sync', pulse: true };
    case 'connecting':
      return { label: 'Connecting', tone: 'sync', pulse: true };
    case 'disconnected':
      return { label: 'Offline', tone: 'off', pulse: false };
    default:
      return { label: '—', tone: 'neutral', pulse: false };
  }
}
