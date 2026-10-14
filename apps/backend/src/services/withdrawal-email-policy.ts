/**
 * On-chain withdrawal creation must not wait on an email OTP.
 * Email confirmation remains only for a historical pending_email_verify row
 * that already has an email. A wallet-native user has no email login.
 */

export type OnchainWithdrawalStatus = 'pending' | 'pending_approval';

export function initialOnchainWithdrawalStatus(needsApproval: boolean): OnchainWithdrawalStatus {
  return needsApproval ? 'pending_approval' : 'pending';
}

export function withdrawalCanUseEmailOtp(status: string, email: string | null | undefined): boolean {
  return status === 'pending_email_verify' && typeof email === 'string' && email.length > 0;
}
