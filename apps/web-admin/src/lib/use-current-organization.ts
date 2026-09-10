'use client';

import { useMyOrganizations, type OrganizationSummary } from '@nexaticket/ts-sdk';
import { useSearchParams } from 'next/navigation';

export interface CurrentOrganization {
  organization: OrganizationSummary | null;
  organizations: OrganizationSummary[];
  isPending: boolean;
  error: unknown;
}

/**
 * Tổ chức đang làm việc.
 *
 * Lấy từ `?org=` trên URL, không phải từ state React. Người thuộc hai tổ chức phải gửi được link
 * "sự kiện của tổ chức B" cho đồng nghiệp, và bấm Back phải quay về đúng tổ chức trước đó.
 *
 * Chỉ nhận `?org=` khi nó **thật sự nằm trong danh sách thành viên** — người dùng sửa tay thanh
 * địa chỉ không được biến thành một tổ chức khác. Backend vẫn kiểm lại và trả 404, nhưng để UI
 * gửi request chắc chắn hỏng thì chỉ tạo ra một màn lỗi khó hiểu.
 */
export function useCurrentOrganization(): CurrentOrganization {
  const searchParams = useSearchParams();
  const query = useMyOrganizations();

  const organizations = query.data ?? [];
  const requested = searchParams.get('org');

  const organization =
    organizations.find((item) => item.id === requested) ?? organizations[0] ?? null;

  return {
    organization,
    organizations,
    isPending: query.isPending,
    error: query.error,
  };
}
