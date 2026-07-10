import { Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenLayout, PrimaryButton, TextField } from '@shared/ui';
import { useTheme } from '@shared/theme';
import type { AuthStackParamList } from '@app/navigation/types';
import { useState } from 'react';

type Props = NativeStackScreenProps<AuthStackParamList, 'ForgotPasswordOtp'>;

export function ForgotPasswordOtpScreen({ route, navigation }: Props) {
  const { theme } = useTheme();
  const [otp, setOtp] = useState('');

  return (
    <ScreenLayout testID="S-111">
      <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>Enter OTP</Text>
      <TextField label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
      <PrimaryButton
        title="Continue"
        onPress={() =>
          navigation.navigate('ForgotPasswordNew', { identifier: route.params.identifier, otp })
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '600', marginBottom: 16 },
});
