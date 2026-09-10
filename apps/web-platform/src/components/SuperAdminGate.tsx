'use client';

import { ApiError, useMyPermissions } from '@nexaticket/ts-sdk';
import { EmptyState, ErrorState, Panel, Skeleton } from '@nexaticket/ui';
import type { ReactNode } from 'react';

/**
 * Chỉ dựng nội dung khi người đang đăng nhập thật sự là quản trị nền tảng.
 *
 * <h3>Đây là lớp hiển thị, không phải lớp bảo vệ</h3>
 *
 * Backend đã chặn đúng: mọi endpoint {@code /v1/platform/**} gọi
 * `TenantContext.requirePlatformPermission` và trả 403 cho người thường. Bỏ component này đi thì
 * hệ thống vẫn an toàn.
 *
 * Thứ nó sửa là **màn hình**. Middleware của app chỉ chặn ở mức "đã đăng nhập hay chưa" — cố ý
 * như vậy, vì middleware chạy ở Edge runtime và không có dữ liệu membership để trả lời câu nào
 * khác. Hệ quả trước đây: một khách hàng bình thường đăng nhập vào cổng 3003 sẽ thấy trọn khung
 * quản trị nền tảng với mọi widget báo lỗi 403. Họ không hiểu mình đang nhìn cái gì, và cũng
 * không biết mình đã vào nhầm cửa.
 *
 * <h3>Vì sao hỏi quyền chứ không hỏi `superAdmin`</h3>
 *
 * `useMyPermissions()` trả cả hai, và cờ `superAdmin` thì ngắn hơn. Nhưng mọi cửa quyền còn lại
 * trong hệ thống — cả backend lẫn frontend — đều hỏi quyền; giữ đúng một cách hỏi ở khắp nơi thì
 * người đọc không phải nhớ chỗ nào là ngoại lệ.
 */
export function SuperAdminGate({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useMyPermissions();

  if (isPending) {
    return (
      <Panel>
        <Skeleton lines={3} />
      </Panel>
    );
  }

  if (error) {
    // Phân biệt "gọi hỏng" với "không có quyền". Gộp hai cái làm một sẽ bảo một superadmin thật
    // rằng họ không phải superadmin, mỗi khi mạng chập chờn.
    return (
      <ErrorState
        error={error instanceof ApiError ? error : null}
        correlationId={error instanceof ApiError ? error.correlationId : null}
        onRetry={() => window.location.reload()}
      />
    );
  }

  if (!data?.platformPermissions.includes('PLATFORM_ORG_MANAGE')) {
    return (
      <EmptyState
        title="Khu vực dành cho quản trị nền tảng"
        description="Tài khoản của bạn không có quyền ở đây. Nếu bạn là ban tổ chức, hãy dùng cổng quản trị tổ chức."
      />
    );
  }

  return <>{children}</>;
}
