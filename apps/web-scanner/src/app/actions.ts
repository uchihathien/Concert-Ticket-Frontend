'use server';

import { signOut } from '@/auth';

/** Nút "Đăng xuất nhân viên" ở màn chọn suất — cùng chỗ với app Scanner. */
export async function signOutStaff() {
  await signOut({ redirectTo: '/login' });
}
