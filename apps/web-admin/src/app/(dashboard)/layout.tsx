import { AppShell, BrandLogo, BrandSuffix, SignOutForm } from '@nexaticket/ui';
import Link from 'next/link';
import { Suspense, type ReactNode } from 'react';
import { signOut } from '@/auth';
import { OrgSwitcher } from '@/components/OrgSwitcher';

/**
 * Khung của khu vực ban tổ chức.
 *
 * Nằm trong route group `(dashboard)` nên không đổi đường dẫn — `/login` vẫn ở ngoài khung.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <AppShell
      brand={
        <>
          <BrandLogo height={26} priority />
          <BrandSuffix>Tổ chức</BrandSuffix>
        </>
      }
      nav={[
        { href: '/', label: 'Sự kiện' },
        { href: '/sales', label: 'Doanh thu' },
        { href: '/venues', label: 'Địa điểm' },
        { href: '/members', label: 'Thành viên' },
        { href: '/audit', label: 'Nhật ký' },
      ]}
      foot={
        <>
          {/* Bộ chọn tổ chức đọc search params — cần ranh giới Suspense, nếu không Next từ chối
              prerender khung này. */}
          <Suspense fallback={null}>
            <OrgSwitcher />
          </Suspense>
          <Link href="/account">Tài khoản</Link>
          <SignOutForm action={doSignOut} />
        </>
      }
    >
      {/* Mọi trang trong khu vực này đọc `?org=` qua `useCurrentOrganization`. Thiếu ranh giới
          Suspense thì Next từ chối prerender và build hỏng — đặt ở đây một lần thay vì bọc lại
          trong từng trang. */}
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
