import { useState } from 'react';
import { TextField } from './TextField';

type Props = Omit<React.ComponentProps<typeof TextField>, 'secureTextEntry' | 'rightIcon' | 'onRightIconPress'>;

export function PasswordInput(props: Props) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      rightIcon={visible ? 'eye-off-outline' : 'eye-outline'}
      onRightIconPress={() => setVisible((v) => !v)}
      autoCapitalize="none"
      textContentType="password"
    />
  );
}
