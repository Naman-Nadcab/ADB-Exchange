import { moneyLabel, type EdaMoneyState } from '@/lib/eda/money-state';

export function EdaMoney(props: { state: EdaMoneyState; currency?: string; className?: string }) {
  const label = moneyLabel(props.state, props.currency ?? 'USD');
  const tone =
    props.state.kind === 'value'
      ? 'font-mono tabular-nums text-white'
      : 'font-mono text-[13px] text-[#9CA3AF]';
  return (
    <span className={`${tone} ${props.className ?? ''}`} aria-live={props.state.kind === 'loading' ? 'polite' : undefined}>
      {label}
    </span>
  );
}
