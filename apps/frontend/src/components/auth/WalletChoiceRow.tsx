import { ChevronRight } from 'lucide-react';
import { WalletBrandMark } from './WalletBrandMark';

type Props = {
  name: string;
  namespace: 'eip155' | 'solana';
  networkLabel: string;
  href?: string;
  disabled?: boolean;
  onClick?: () => void;
};

const rowClass =
  'group flex w-full items-center gap-3 rounded-xl border border-border bg-background/70 px-3 py-2.5 text-left shadow-sm transition-colors hover:border-primary/45 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50';

function Body({ name, namespace, networkLabel }: Pick<Props, 'name' | 'namespace' | 'networkLabel'>) {
  return (
    <>
      <WalletBrandMark name={name} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
        <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
          namespace === 'solana' ? 'bg-violet-600 text-white' : 'bg-primary text-primary-foreground'
        }`}>
          {networkLabel}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </>
  );
}

export function WalletChoiceRow({ name, namespace, networkLabel, href, disabled, onClick }: Props) {
  if (href) {
    return (
      <a href={href} className={rowClass}>
        <Body name={name} namespace={namespace} networkLabel={networkLabel} />
      </a>
    );
  }
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={rowClass}>
      <Body name={name} namespace={namespace} networkLabel={networkLabel} />
    </button>
  );
}
