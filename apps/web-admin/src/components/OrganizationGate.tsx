'use client';

import { ApiError, type OrganizationSummary } from '@nexaticket/ts-sdk';
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from '@nexaticket/ui';
import type { ReactNode } from 'react';
import { useCurrentOrganization } from '@/lib/use-current-organization';

export interface OrganizationGateProps {
  title: string;
  children: (organization: OrganizationSummary) => ReactNode;
}

/**
 * Chỉ dựng nội dung khi đã biết đang làm việc cho tổ chức nào.
 *
 * Tồn tại để **không nhập nhằng ba trạng thái khác nhau**: đang tải, gọi hỏng, và không thuộc tổ
 * chức nào. Bản đầu tiên của mấy trang này gộp hai cái sau làm một và hiện "Bạn chưa thuộc tổ
 * chức nào" ngay cả khi request thất bại — người dùng sẽ đi hỏi quản trị viên cấp quyền, trong
 * khi vấn đề thật nằm ở mạng hoặc ở máy chủ.
 */
export function OrganizationGate({ title, children }: OrganizationGateProps) {
  const { organization, isPending, error } = useCurrentOrganization();

  if (isPending) {
    return (
      <>
        <PageHeader title={title} />
        <Panel>
          <Skeleton lines={3} />
        </Panel>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title={title} />
        <ErrorState
          error={error instanceof ApiError ? error : null}
          correlationId={error instanceof ApiError ? error.correlationId : null}
          onRetry={() => window.location.reload()}
        />
      </>
    );
  }

  if (!organization) {
    return (
      <>
        <PageHeader title={title} />
        <EmptyState
          title="Bạn chưa thuộc tổ chức nào"
          description="Tài khoản ban tổ chức do quản trị nền tảng cấp. Nếu vừa nhận lời mời, hãy mở lại đường dẫn trong email."
        />
      </>
    );
  }

  return <>{children(organization)}</>;
}
