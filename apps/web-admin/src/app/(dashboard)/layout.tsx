import { AppShell, BrandLogo, BrandSuffix, SignOutForm } from '@nexaticket/ui';
import {
  BarChart3,
  CalendarDays,
  LayoutDashboard,
  MapPin,
  ScrollText,
  TicketCheck,
  UserCircle2,
  Users,
} from 'lucide-react';
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
          <BrandLogo variant="lockup-on-light" height={26} priority />
          <BrandSuffix>Tổ chức</BrandSuffix>
        </>
      }
      nav={[
        // Biểu tượng đi KÈM chữ, không thay chữ: cột toàn hình buộc người dùng phải đoán, và
        // đoán sai ở khu quản trị nghĩa là mở nhầm màn.
        { href: '/', label: 'Sự kiện', icon: <CalendarDays size={18} /> },
        { href: '/overview', label: 'Tổng quan', icon: <LayoutDashboard size={18} /> },
        { href: '/tickets', label: 'Vé đã bán', icon: <TicketCheck size={18} /> },
        { href: '/sales', label: 'Doanh thu', icon: <BarChart3 size={18} /> },
        { href: '/venues', label: 'Địa điểm', icon: <MapPin size={18} /> },
        { href: '/members', label: 'Thành viên', icon: <Users size={18} /> },
        { href: '/audit', label: 'Nhật ký', icon: <ScrollText size={18} /> },
      ]}
      foot={
        <>
          {/* Bộ chọn tổ chức đọc search params — cần ranh giới Suspense, nếu không Next từ chối
              prerender khung này. */}
          <Suspense fallback={null}>
            <OrgSwitcher />
          </Suspense>
          <Link href="/account" className="inline-flex items-center gap-2 no-underline">
            <UserCircle2 size={18} aria-hidden="true" />
            Tài khoản
          </Link>
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
