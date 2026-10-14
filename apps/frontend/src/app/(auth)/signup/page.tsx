import { redirect } from 'next/navigation';

type Search = Record<string, string | string[] | undefined>;

/** Account creation is the first wallet sign-in. Keep old links working. */
export default function SignupPage({ searchParams }: { searchParams?: Search }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === 'string') params.set(key, value);
    else if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    }
  }
  const query = params.toString();
  redirect(query ? `/login?${query}` : '/login');
}
