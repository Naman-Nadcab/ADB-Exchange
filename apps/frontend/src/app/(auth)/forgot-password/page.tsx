import { redirect } from 'next/navigation';

/** Password reset is not a customer sign-in path. Wallet login is the screen. */
export default function ForgotPasswordPage() {
  redirect('/login');
}
