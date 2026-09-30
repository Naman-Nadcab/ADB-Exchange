import { BRAND_NAME_FULL, BRAND_NAME_SHORT } from '@/lib/brand';

export const metadata = {
  title: `${BRAND_NAME_SHORT} Admin`,
  description: `${BRAND_NAME_FULL} Admin Dashboard`,
};

export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
