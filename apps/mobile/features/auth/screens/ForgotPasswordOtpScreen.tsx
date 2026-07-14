import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { AuthScreenShell } from '../components/AuthScreenShell';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

export function ForgotPasswordOtpScreen({ route, navigation }: Props) {
  const [otp, setOtp] = useState('');

  return (
    <AuthScreenShell testID="S-111" title="Enter OTP" subtitle={`Sent to ${route.params.identifier}`} onBack={() => navigation.goBack()}>
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} />
      </View>
      <PrimaryButton
        title="Continue"
        onPress={() =>
          navigation.navigate('ForgotPasswordNew', { identifier: route.params.identifier, otp })
        }
      />
    </AuthScreenShell>
  );
}
