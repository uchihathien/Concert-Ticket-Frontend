'use client';

import { Select } from '@nexaticket/ui';
import { usePathname, useRouter } from 'next/navigation';
import { rememberOrganization, useCurrentOrganization } from '@/lib/use-current-organization';

/**
 * Chọn tổ chức đang làm việc.
 *
 * Chỉ hiện khi người dùng thuộc từ hai tổ chức trở lên. Một ô chọn có đúng một lựa chọn là tiếng
 * ồn, và nó còn gợi ý sai rằng có chỗ nào đó để chuyển sang.
 *
 * Ghi lựa chọn vào URL rồi để trang tự đọc lại, thay vì giữ trong state: nhờ vậy link chia sẻ
 * được và nút Back hoạt động đúng.
 */
export function OrgSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { organization, organizations } = useCurrentOrganization();

  if (organizations.length < 2 || !organization) return null;

  return (
    <Select
      label="Tổ chức"
      value={organization.id}
      onChange={(event) => {
        rememberOrganization(event.target.value);
        // Bộ lọc trên URL (sự kiện, suất, loại vé…) là của tổ chức cũ; mang chúng sang tổ chức mới
        // chỉ cho ra một trang trống. Bỏ cả `org` khỏi URL: lựa chọn đã được ghi nhớ.
        router.push(pathname);
      }}
      options={organizations.map((item) => ({ value: item.id, label: item.name }))}
    />
  );
}
