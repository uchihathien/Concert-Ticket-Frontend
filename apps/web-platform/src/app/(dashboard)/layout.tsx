import { AppShell, BrandLogo, BrandSuffix, SignOutForm } from '@nexaticket/ui';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { signOut } from '@/auth';
import { SuperAdminGate } from '@/components/SuperAdminGate';

/**
 * Khung của khu vực quản trị nền tảng.
 *
 * Nằm trong route group `(dashboard)` nên không đổi đường dẫn — `/login` vẫn ở ngoài khung, đúng
 * như nó phải thế: màn đăng nhập không có cột điều hướng dẫn đi chỗ khác.
 *
 * `SuperAdminGate` bọc phần nội dung, KHÔNG bọc cả khung: người vào nhầm cửa vẫn phải thấy nút
 * "Đăng xuất" để thoát ra. Bọc cả khung là nhốt họ lại trong một trang trắng.
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
          <BrandSuffix>Nền tảng</BrandSuffix>
        </>
      }
      nav={[
        { href: '/', label: 'Tổ chức' },
        { href: '/ledger', label: 'Sổ cái' },
      ]}
      foot={
        <>
          <Link href="/account">Tài khoản</Link>
          <SignOutForm action={doSignOut} />
        </>
      }
    >
      <SuperAdminGate>{children}</SuperAdminGate>
    </AppShell>
  );
}
