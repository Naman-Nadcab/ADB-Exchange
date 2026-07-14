import { TextField } from './TextField';

type Props = Omit<React.ComponentProps<typeof TextField>, 'keyboardType' | 'leftIcon'> & {
  symbol?: string;
};

export function AmountInput({ symbol, ...props }: Props) {
  return (
    <TextField
      {...props}
      keyboardType="decimal-pad"
      leftIcon={symbol ? undefined : 'calculator-outline'}
      placeholder={props.placeholder ?? '0.00'}
    />
  );
}
