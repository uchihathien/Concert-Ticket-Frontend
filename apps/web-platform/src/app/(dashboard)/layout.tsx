import { AppShell, BrandLogo, BrandSuffix, SidebarAccount } from '@nexaticket/ui';
import {
  Building2,
  BookOpen,
  FileText,
  Headset,
  LayoutTemplate,
  Scale,
  ScrollText,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { auth, signOut } from '@/auth';
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
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  async function doSignOut() {
    'use server';
    await signOut({ redirectTo: '/login' });
  }

  return (
    <AppShell
      brand={
        <>
          <BrandLogo variant="lockup" height={26} priority />
          <BrandSuffix>Nền tảng</BrandSuffix>
        </>
      }
      navLabel="Quản trị nền tảng"
      nav={[
        // Biểu tượng đi KÈM chữ, không thay chữ: cột điều hướng toàn hình thì người dùng phải
        // đoán, và đoán sai ở khu quản trị nghĩa là mở nhầm màn.
        { href: '/organizations', label: 'Tổ chức', icon: <Building2 size={18} /> },
        { href: '/templates', label: 'Khung mẫu', icon: <LayoutTemplate size={18} /> },
        { href: '/ledger', label: 'Sổ cái', icon: <Scale size={18} /> },
        { href: '/support', label: 'Bàn hỗ trợ', icon: <Headset size={18} /> },
        { href: '/knowledge', label: 'Kho tri thức', icon: <BookOpen size={18} /> },
        { href: '/event-rules', label: 'Quy định sự kiện', icon: <FileText size={18} /> },
        { href: '/audit', label: 'Nhật ký', icon: <ScrollText size={18} /> },
      ]}
      foot={
        <>
          <SidebarAccount
            name={session?.user?.name}
            email={session?.user?.email}
            href="/account"
            signOutAction={doSignOut}
          />
        </>
      }
    >
      <SuperAdminGate>{children}</SuperAdminGate>
    </AppShell>
  );
}
