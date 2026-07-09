import { redirect } from 'next/navigation';

/** Legacy/auth middleware path → canonical forgot-password flow. */
export default function ResetPasswordRedirectPage() {
  redirect('/forgot-password');
}
