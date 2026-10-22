import { waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useUserLifecycle } from '../platform-users';
import { renderHookWithApi } from './harness';

describe('useUserLifecycle', () => {
  it('vô hiệu hoá: POST .../disable kèm lý do', async () => {
    const { result, calls } = renderHookWithApi(
      () => useUserLifecycle(),
      () => ({ status: 204 }),
    );
    result.current.mutate({ userId: 'u-9', action: 'disable', reason: 'Gian lận' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls).toEqual([
      { method: 'POST', path: '/v1/platform/users/u-9/disable', body: { reason: 'Gian lận' } },
    ]);
  });

  it('khôi phục: POST .../enable không body', async () => {
    const { result, calls } = renderHookWithApi(
      () => useUserLifecycle(),
      () => ({ status: 204 }),
    );
    result.current.mutate({ userId: 'u-9', action: 'enable' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', path: '/v1/platform/users/u-9/enable' });
    expect(calls[0]!.body).toBeUndefined();
  });

  it('thành công thì làm hỏng cache nhật ký nền tảng (mỗi lệnh ghi một dòng nhật ký)', async () => {
    const { result, queryClient } = renderHookWithApi(
      () => useUserLifecycle(),
      () => ({ status: 204 }),
    );
    queryClient.setQueryData(['identity', 'platform', 'audit'], []);
    result.current.mutate({ userId: 'u-9', action: 'enable' });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(queryClient.getQueryState(['identity', 'platform', 'audit'])?.isInvalidated).toBe(true);
  });

  it('tự khoá chính mình bị server từ chối 403 thì mutation báo lỗi và không làm hỏng cache', async () => {
    const { result, queryClient } = renderHookWithApi(
      () => useUserLifecycle(),
      () => ({ status: 403, body: { code: 'FORBIDDEN' } }),
    );
    queryClient.setQueryData(['identity', 'platform', 'audit'], []);
    result.current.mutate({ userId: 'me', action: 'disable', reason: 'x' });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryState(['identity', 'platform', 'audit'])?.isInvalidated).toBe(false);
  });
});
