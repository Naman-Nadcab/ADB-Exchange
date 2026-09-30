import { redirect } from 'next/navigation';

/** Canonical Command Center lives at `/forex`; alias for operator docs. */
export default function ForexOverviewAliasPage() {
  redirect('/forex');
}
