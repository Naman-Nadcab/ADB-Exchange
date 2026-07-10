import { useState, useEffect } from 'react';
import { View, Text, Modal, StyleSheet } from 'react-native';
import { TextField, PrimaryButton, ErrorBanner } from '@shared/ui';
import { useTheme } from '@shared/theme';
import { useVerify2FA, useWithdrawalEmailOtp, useVerifyWithdrawalEmailOtp } from '../hooks/useBlockchainWallet';

type SecurityInput = {
  twoFactorCode?: string;
  fund_password?: string;
};

type Props = {
  visible: boolean;
  withdrawalId?: string;
  needs2FA: boolean;
  needsFundPassword: boolean;
  needsEmailOtp: boolean;
  onClose: () => void;
  onComplete: (input: SecurityInput) => void;
};

export function WithdrawSecurityWizard({
  visible,
  withdrawalId,
  needs2FA,
  needsFundPassword,
  needsEmailOtp,
  onClose,
  onComplete,
}: Props) {
  const { theme } = useTheme();
  const [step, setStep] = useState(0);
  const [twoFa, setTwoFa] = useState('');
  const [fundPw, setFundPw] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const verify2fa = useVerify2FA();
  const sendOtp = useWithdrawalEmailOtp();
  const verifyOtp = useVerifyWithdrawalEmailOtp();

  const steps = [
    needs2FA && '2FA',
    needsFundPassword && 'Fund Password',
    needsEmailOtp && 'Email OTP',
  ].filter(Boolean) as string[];

  const finish = () => {
    onComplete({
      twoFactorCode: needs2FA ? twoFa : undefined,
      fund_password: needsFundPassword ? fundPw : undefined,
    });
    setStep(0);
    setTwoFa('');
    setFundPw('');
    setOtp('');
    setError(null);
  };

  const next = async () => {
    setError(null);
    if (steps[step] === '2FA') {
      try {
        await verify2fa.mutateAsync(twoFa);
        setStep((s) => s + 1);
      } catch {
        setError('Invalid 2FA code');
      }
      return;
    }
    if (steps[step] === 'Fund Password') {
      if (!fundPw) {
        setError('Fund password required');
        return;
      }
      setStep((s) => s + 1);
      return;
    }
    if (steps[step] === 'Email OTP') {
      if (!withdrawalId) {
        finish();
        return;
      }
      try {
        await verifyOtp.mutateAsync({ id: withdrawalId, otp });
        finish();
      } catch {
        setError('Invalid email OTP');
      }
      return;
    }
    finish();
  };

  const requestOtp = async () => {
    if (!withdrawalId) return;
    try {
      await sendOtp.mutateAsync(withdrawalId);
    } catch {
      setError('Failed to send email OTP');
    }
  };

  useEffect(() => {
    if (!visible || steps[step] !== 'Email OTP' || !withdrawalId) return;
    void sendOtp.mutateAsync(withdrawalId).catch(() => setError('Failed to send email OTP'));
  }, [visible, step, steps, withdrawalId, sendOtp]);

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: `hsl(${theme.colors.backgroundPrimary})` }]}>
          <Text style={[styles.title, { color: `hsl(${theme.colors.foregroundPrimary})` }]}>
            Withdrawal Security (W-510)
          </Text>
          <Text style={{ color: `hsl(${theme.colors.foregroundSecondary})`, marginBottom: 12 }}>
            Step {step + 1}/{steps.length || 1}: {steps[step] ?? 'Confirm'}
          </Text>
          {steps[step] === '2FA' ? (
            <TextField label="2FA Code" value={twoFa} onChangeText={setTwoFa} keyboardType="number-pad" />
          ) : null}
          {steps[step] === 'Fund Password' ? (
            <TextField label="Fund Password" value={fundPw} onChangeText={setFundPw} secureTextEntry />
          ) : null}
          {steps[step] === 'Email OTP' ? (
            <>
              <PrimaryButton title="Send Email OTP" variant="secondary" onPress={() => void requestOtp()} />
              <TextField label="Email OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
            </>
          ) : null}
          {error ? <ErrorBanner message={error} /> : null}
          <View style={styles.actions}>
            <PrimaryButton title="Cancel" variant="secondary" onPress={onClose} />
            <PrimaryButton title="Continue" onPress={() => void next()} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  card: { padding: 20, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 16 },
});
