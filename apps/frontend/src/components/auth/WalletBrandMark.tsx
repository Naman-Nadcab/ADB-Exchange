import type { ReactNode } from 'react';

type Props = { name: string };

function frame(color: string, children: ReactNode) {
  return (
    <span
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70"
      style={{ backgroundColor: color }}
      aria-hidden
    >
      {children}
    </span>
  );
}

export function WalletBrandMark({ name }: Props) {
  const key = name.toLowerCase();
  if (key.includes('metamask')) {
    return frame('#F6851B', (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M5 11.2 8.4 4.2 12 8.6 15.6 4.2 19 11.2 12 19.8 5 11.2Z" fill="#fff" />
        <path d="M8.4 4.2 12 8.6 15.6 4.2M12 8.6v11.2" stroke="#C45C12" strokeWidth="1.15" strokeLinejoin="round" />
      </svg>
    ));
  }
  if (key.includes('trust')) {
    return frame('#0500FF', (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M12 3.5 18.5 6v5.2c0 3.8-2.6 6.6-6.5 8.3-3.9-1.7-6.5-4.5-6.5-8.3V6L12 3.5Z" fill="#FFF" />
        <path d="M12 7.2v8.2" stroke="#0500FF" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    ));
  }
  if (key.includes('coinbase')) {
    return frame('#0052FF', (
      <svg viewBox="0 0 24 24" className="h-6 w-6">
        <circle cx="12" cy="12" r="6.2" fill="none" stroke="#FFF" strokeWidth="2.6" />
      </svg>
    ));
  }
  if (key.includes('phantom')) {
    return frame('#AB9FF2', (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#FFF">
        <path d="M7 18.5c0-4.8 1.2-9 5-11.5 3.8 2.5 5 6.7 5 11.5 0 .8-.7 1.5-1.5 1.5h-7c-.8 0-1.5-.7-1.5-1.5Z" />
        <circle cx="10" cy="12" r="1" fill="#AB9FF2" />
        <circle cx="14" cy="12" r="1" fill="#AB9FF2" />
      </svg>
    ));
  }
  if (key.includes('walletconnect')) {
    return frame('#3B99FC', (
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
        <path d="M7 12a5 5 0 0 1 10 0" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M9.2 14.2a2.8 2.8 0 0 1 5.6 0" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="16.8" r="1.2" fill="#FFF" />
      </svg>
    ));
  }
  return frame('hsl(var(--primary))', (
    <span className="text-sm font-bold text-primary-foreground">{name.slice(0, 1).toUpperCase()}</span>
  ));
}
