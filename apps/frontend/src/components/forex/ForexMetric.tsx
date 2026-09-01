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
    <div className="min-w-[140px] rounded border border-stone-200 bg-white px-3 py-2 dark:border-stone-800 dark:bg-[#101214]">
      <div className="text-[10px] uppercase tracking-wide text-stone-500">{props.label}</div>
      <div
        className={`font-mono text-[15px] tabular-nums ${
          tone === 'pos' ? 'text-emerald-700 dark:text-emerald-400' : tone === 'neg' ? 'text-rose-700 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'
        }`}
      >
        {text}
      </div>
      {props.hint ? <div className="text-[10px] text-stone-400">{props.hint}</div> : null}
    </div>
  );
}
