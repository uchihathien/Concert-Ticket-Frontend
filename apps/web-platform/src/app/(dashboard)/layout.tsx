import { AppShell, BrandLogo, BrandSuffix, SignOutForm } from '@nexaticket/ui';
import { Building2, BookOpen, Headset, Scale, UserCircle2 } from 'lucide-react';
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
          <BrandLogo variant="lockup-on-light" height={26} priority />
          <BrandSuffix>Nền tảng</BrandSuffix>
        </>
      }
      nav={[
        // Biểu tượng đi KÈM chữ, không thay chữ: cột điều hướng toàn hình thì người dùng phải
        // đoán, và đoán sai ở khu quản trị nghĩa là mở nhầm màn.
        { href: '/organizations', label: 'Tổ chức', icon: <Building2 size={18} /> },
        { href: '/ledger', label: 'Sổ cái', icon: <Scale size={18} /> },
        { href: '/support', label: 'Bàn hỗ trợ', icon: <Headset size={18} /> },
        { href: '/knowledge', label: 'Kho tri thức', icon: <BookOpen size={18} /> },
      ]}
      foot={
        <>
          <Link href="/account" className="inline-flex items-center gap-2 no-underline">
            <UserCircle2 size={18} aria-hidden="true" />
            Tài khoản
          </Link>
          <SignOutForm action={doSignOut} />
        </>
      }
    >
      <SuperAdminGate>{children}</SuperAdminGate>
    </AppShell>
  );
}
