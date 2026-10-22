import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  TEMPLATE_STATUS_LABELS,
  templateStatusTone,
  useCreateTemplate,
  useDeleteTemplate,
  usePlatformTemplate,
  usePlatformTemplates,
  useReplaceTemplateZones,
  useTemplateStatus,
  useUpdateTemplate,
  type TemplateDetail,
  type TemplateStatus,
} from '../concert-templates';
import { renderHookWithApi } from './harness';

const DETAIL: TemplateDetail = {
  id: 't1',
  code: 'ARENA',
  name: 'Nhà thi đấu',
  category: 'MUSIC',
  description: null,
  status: 'DRAFT',
  capacity: 100,
  stage: null,
  zones: [],
};

describe('nhãn và tông màu trạng thái khung', () => {
  it.each<[TemplateStatus, string, string]>([
    ['DRAFT', 'Nháp', 'neutral'],
    ['ACTIVE', 'Đang mở', 'success'],
    ['ARCHIVED', 'Đã lưu trữ', 'warn'],
  ])('%s → nhãn "%s", tông %s', (status, label, tone) => {
    expect(TEMPLATE_STATUS_LABELS[status]).toBe(label);
    expect(templateStatusTone(status)).toBe(tone);
  });

  it('đủ nhãn cho cả ba trạng thái, không thiếu cái nào', () => {
    expect(Object.keys(TEMPLATE_STATUS_LABELS).sort()).toEqual(['ACTIVE', 'ARCHIVED', 'DRAFT']);
  });
});

describe('usePlatformTemplates', () => {
  it('không lọc thì gọi danh sách trần, không kèm ?status', async () => {
    const { result, calls } = renderHookWithApi(
      () => usePlatformTemplates(),
      () => ({ status: 200, body: [] }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls.map((c) => c.path)).toEqual(['/v1/platform/concert-templates']);
  });

  it('lọc theo trạng thái thì thêm ?status=', async () => {
    const { result, calls } = renderHookWithApi(
      () => usePlatformTemplates('ACTIVE'),
      () => ({ status: 200, body: [{ id: 't1' }] }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]!.path).toBe('/v1/platform/concert-templates?status=ACTIVE');
    expect(result.current.data).toEqual([{ id: 't1' }]);
  });

  it('lỗi server đi vào trạng thái lỗi chứ không trả danh sách rỗng', async () => {
    const { result } = renderHookWithApi(
      () => usePlatformTemplates(),
      () => ({ status: 500, body: { code: 'INTERNAL' } }),
    );
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});

describe('usePlatformTemplate', () => {
  it('đọc chi tiết theo id', async () => {
    const { result, calls } = renderHookWithApi(
      () => usePlatformTemplate('t1'),
      () => ({ status: 200, body: DETAIL }),
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]!.path).toBe('/v1/platform/concert-templates/t1');
    expect(result.current.data?.code).toBe('ARENA');
  });
});

describe('các lệnh ghi khung', () => {
  it('tạo khung: POST body đúng; kết quả ghi thẳng vào cache chi tiết và làm hỏng cache danh sách', async () => {
    const { result, calls, queryClient } = renderHookWithApi(
      () => useCreateTemplate(),
      () => ({ status: 200, body: DETAIL }),
    );
    queryClient.setQueryData(['catalog', 'platform', 'concert-templates', 'list', ''], []);

    result.current.mutate({ code: 'ARENA', name: 'Nhà thi đấu', category: 'MUSIC', description: null });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls[0]).toEqual({
      method: 'POST',
      path: '/v1/platform/concert-templates',
      body: { code: 'ARENA', name: 'Nhà thi đấu', category: 'MUSIC', description: null },
    });
    expect(queryClient.getQueryData(['catalog', 'platform', 'concert-templates', 'detail', 't1'])).toEqual(
      DETAIL,
    );
    expect(
      queryClient.getQueryState(['catalog', 'platform', 'concert-templates', 'list', ''])?.isInvalidated,
    ).toBe(true);
  });

  it('sửa khung dùng PATCH, thay cả tập khu dùng PUT .../zones', async () => {
    const { result: update, calls } = renderHookWithApi(
      () => ({ update: useUpdateTemplate('t1'), zones: useReplaceTemplateZones('t1') }),
      () => ({ status: 200, body: DETAIL }),
    );
    update.current.update.mutate({ name: 'Tên mới' });
    await waitFor(() => expect(update.current.update.isSuccess).toBe(true));
    update.current.zones.mutate({
      stage: { shape: 'RECT', x: 0, y: 0, width: 10 },
      zones: [{ zoneCode: 'A', name: 'Khu A', kind: 'SEATED', rowCount: 2, seatsPerRow: 5 }],
    });
    await waitFor(() => expect(update.current.zones.isSuccess).toBe(true));

    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      'PATCH /v1/platform/concert-templates/t1',
      'PUT /v1/platform/concert-templates/t1/zones',
    ]);
    expect(calls[0]!.body).toEqual({ name: 'Tên mới' });
    expect(calls[1]!.body).toMatchObject({ zones: [{ zoneCode: 'A', kind: 'SEATED' }] });
  });

  it.each(['activate', 'archive', 'draft'] as const)('đổi trạng thái %s là POST .../%s không body', async (action) => {
    const { result, calls } = renderHookWithApi(
      () => useTemplateStatus('t1'),
      () => ({ status: 200, body: { ...DETAIL, status: 'ACTIVE' } }),
    );
    result.current.mutate(action);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/v1/platform/concert-templates/t1/${action}`,
    });
    expect(calls[0]!.body).toBeUndefined();
  });

  it('xoá khung: DELETE, chỉ làm hỏng cache danh sách', async () => {
    const { result, calls, queryClient } = renderHookWithApi(
      () => useDeleteTemplate('t1'),
      () => ({ status: 204 }),
    );
    queryClient.setQueryData(['catalog', 'platform', 'concert-templates', 'list', ''], []);
    result.current.mutate();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls[0]).toMatchObject({ method: 'DELETE', path: '/v1/platform/concert-templates/t1' });
    expect(
      queryClient.getQueryState(['catalog', 'platform', 'concert-templates', 'list', ''])?.isInvalidated,
    ).toBe(true);
  });

  it('server từ chối (khung đang được dùng) thì mutation báo lỗi', async () => {
    const { result } = renderHookWithApi(
      () => useDeleteTemplate('t1'),
      () => ({ status: 409, body: { code: 'TEMPLATE_IN_USE' } }),
    );
    result.current.mutate();
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
