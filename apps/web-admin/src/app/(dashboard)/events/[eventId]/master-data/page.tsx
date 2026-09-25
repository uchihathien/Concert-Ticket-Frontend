'use client';

import { useEventMasterData } from '@nexaticket/ts-sdk';
import { Button, ErrorState, PageHeader, Skeleton } from '@nexaticket/ui';
import { ArrowLeft, Settings2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { EventMasterPanel } from '@/components/EventMasterPanel';
import { OrganizationGate } from '@/components/OrganizationGate';

/**
 * A-MASTER — toàn bộ số liệu của MỘT sự kiện.
 *
 * <h3>Vì sao có trang riêng thay vì chỉ nằm trong Tổng quan</h3>
 *
 * Bảng Tổng quan trả lời câu "tổ chức của tôi đang thế nào" — nó cần bộ lọc, biểu đồ, và một khối
 * master data mở ra ngay dưới bảng. Trang này trả lời câu khác: "sự kiện NÀY đang thế nào", và nó
 * cần một thứ mà khối nhúng kia không có được — **một địa chỉ**. Ban tổ chức gửi link cho kế toán,
 * mở lại từ lịch sử trình duyệt, ghim vào tab. Một khối mở ra bằng cú bấm vào dòng trong bảng thì
 * không chia sẻ được, và F5 một cái là mất.
 *
 * Cả hai dùng chung {@code EventMasterPanel}, nên không có bản thứ hai nào để lệch.
 *
 * <h3>Bấm vào sự kiện là tới đây, không phải tới trang sửa</h3>
 *
 * Phần lớn lần mở một sự kiện là để XEM nó bán thế nào, không phải để sửa giá. Nên dòng trong bảng
 * dẫn tới đây, còn đường sửa suất và giá là một nút riêng — ở cả hai nơi.
 */
export default function EventMasterDataPage() {
  const params = useParams<{ eventId: string }>();
  const eventId = params.eventId;

  return (
    <OrganizationGate title="Số liệu sự kiện">
      {(organization) => (
        <Content organizationId={organization.id} eventId={eventId} org={organization} />
      )}
    </OrganizationGate>
  );
}

function Content({
  organizationId,
  eventId,
  org,
}: {
  organizationId: string;
  eventId: string;
  org: Parameters<typeof EventMasterPanel>[0]['organization'];
}) {
  const query = useEventMasterData(organizationId, eventId);

  const back = (
    <Link href={`/?org=${organizationId}`}>
      <Button variant="secondary">
        <ArrowLeft size={16} aria-hidden="true" />
        Danh sách sự kiện
      </Button>
    </Link>
  );

  if (query.isPending) {
    return (
      <>
        <PageHeader title="Số liệu sự kiện" actions={back} />
        <Skeleton lines={6} />
      </>
    );
  }

  if (query.isError || !query.data) {
    return (
      <>
        <PageHeader title="Số liệu sự kiện" actions={back} />
        <ErrorState error={null} onRetry={() => void query.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={query.data.event.title}
        description="Số bán, doanh thu, tồn kho theo khu và toàn bộ cấu hình của sự kiện."
        actions={
          <>
            {back}
            <Link href={`/events/${eventId}?org=${organizationId}`}>
              <Button variant="secondary">
                <Settings2 size={16} aria-hidden="true" />
                Suất & giá vé
              </Button>
            </Link>
          </>
        }
      />
      <EventMasterPanel data={query.data} organization={org} />
    </>
  );
}
