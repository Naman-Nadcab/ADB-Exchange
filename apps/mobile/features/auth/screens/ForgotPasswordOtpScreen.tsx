import { useState } from 'react';
import { View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { PrimaryButton, OTPInput } from '@shared/ui';
import type { AuthStackParamList } from '@app/navigation/types';
import { AuthSplitLayout } from '../components/AuthSplitLayout';
import { AuthFormHeading } from '../components/AuthFormHeading';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

export function ForgotPasswordOtpScreen({ route, navigation }: Props) {
  const [otp, setOtp] = useState('');

  return (
    <AuthSplitLayout testID="S-111" showMarketingLogo onBack={() => navigation.goBack()}>
      <AuthFormHeading
        title="Reset password"
        subtitle={`Enter the 6-digit code sent to ${route.params.identifier}`}
      />
      <View style={{ alignItems: 'center', marginVertical: 24 }}>
        <OTPInput value={otp} onChange={setOtp} />
      </View>
      <PrimaryButton
        title="Continue"
        size="xl"
        disabled={otp.length !== 6}
        onPress={() =>
          navigation.navigate('ForgotPasswordNew', { identifier: route.params.identifier, otp })
        }
      />
    </AuthSplitLayout>
  );
}
