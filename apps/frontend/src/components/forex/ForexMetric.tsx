import { cn } from '@/lib/utils';
import { fxMoney, fxSigned } from './format';

export function ForexMetric(props: {
  label: string;
  value: string | number | null | undefined;
  currency?: string;
  signed?: boolean;
  hint?: string;
  kind?: 'money' | 'plain';
}) {
  const signed = props.signed ? fxSigned(props.value) : null;
  const text = signed
    ? signed.text
    : props.kind === 'plain'
      ? props.value == null || props.value === ''
        ? 'Unavailable'
        : String(props.value)
      : fxMoney(props.value, props.currency ?? 'USD');
  const tone = signed?.tone;
  return (
    <div className="eda-metric">
      <div className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{props.label}</div>
      <div
        className={cn(
          'mt-1 font-mono text-[15px] tabular-nums',
          tone === 'pos' ? 'text-buy' : tone === 'neg' ? 'text-sell' : 'text-foreground'
        )}
      >
        {text}
      </div>
      {props.hint ? <div className="mt-0.5 text-[10px] text-muted-foreground">{props.hint}</div> : null}
    </div>
  );
}
