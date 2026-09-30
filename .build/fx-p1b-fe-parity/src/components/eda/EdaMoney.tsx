import { moneyLabel, type EdaMoneyState } from '@/lib/eda/money-state';

export function EdaMoney(props: {
  state: EdaMoneyState;
  currency?: string;
  className?: string;
  /** Color by sign when a real numeric value exists. Never invents a tone for loading/unavailable. */
  signed?: boolean;
}) {
  const label = moneyLabel(props.state, props.currency ?? 'USD');
  let tone = 'font-mono text-[13px] text-muted-foreground';
  if (props.state.kind === 'value') {
    if (props.signed) {
      const n = Number(props.state.raw);
      tone = Number.isFinite(n)
        ? n > 0
          ? 'font-mono tabular-nums text-buy'
          : n < 0
            ? 'font-mono tabular-nums text-sell'
            : 'font-mono tabular-nums text-foreground'
        : 'font-mono tabular-nums text-foreground';
    } else {
      tone = 'font-mono tabular-nums text-foreground';
    }
  }
  return (
    <span className={`${tone} ${props.className ?? ''}`} aria-live={props.state.kind === 'loading' ? 'polite' : undefined}>
      {label}
    </span>
  );
}
