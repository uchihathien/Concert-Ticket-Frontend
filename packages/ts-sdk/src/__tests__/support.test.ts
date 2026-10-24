// @vitest-environment node
//
// Môi trường node, cùng lý do với client.test.ts: fetch của undici từ chối AbortSignal của jsdom.
import { HttpResponse, http } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cancelProposal, confirmProposal } from '../api/support';
import { ApiError } from '../http/api-error';
import { createApiClient } from '../http/client';
import type { PaymentCard } from '../types/support';

const BASE_URL = 'http://gateway.test';
const PROPOSAL = '11111111-1111-4111-8111-111111111111';

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const client = () => createApiClient({ baseUrl: BASE_URL });

const paymentCard: PaymentCard = {
  kind: 'PAYMENT',
  orderId: 'o1',
  orderNumber: 'NT-260925-FSQM90',
  totalVnd: 3_600_000,
  vietQrPayload: '00020101021238570010A000000727',
  paymentReference: 'NT260925FSQM90',
  checkoutUrl: 'https://pay.payos.test/web/abc',
  paymentExpiresAt: '2026-10-23T10:15:00Z',
};

describe('nút Đồng ý / Huỷ trên thẻ đề xuất (story 1.5)', () => {
  it('confirmProposal POST đúng đường dẫn với body rỗng và trả thẻ PAYMENT', async () => {
    let seenBody: unknown = null;
    server.use(
      http.post(`${BASE_URL}/v1/chat/agent/proposals/${PROPOSAL}/confirm`, async ({ request }) => {
        seenBody = await request.json();
        return HttpResponse.json(
          {
            proposalId: PROPOSAL,
            status: 'CONFIRMED',
            order: {
              orderId: 'o1',
              orderNumber: 'NT-260925-FSQM90',
              totalVnd: 3_600_000,
              checkoutUrl: 'https://pay.payos.test/web/abc',
              paymentExpiresAt: '2026-10-23T10:15:00Z',
            },
            action: paymentCard,
          },
          { status: 201 },
        );
      }),
    );

    const confirmation = await confirmProposal(client(), PROPOSAL);

    expect(seenBody).toEqual({});
    expect(confirmation.status).toBe('CONFIRMED');
    expect(confirmation.action.kind).toBe('PAYMENT');
    expect(confirmation.action.vietQrPayload).toBe('00020101021238570010A000000727');
    expect(confirmation.order.orderNumber).toBe('NT-260925-FSQM90');
  });

  it('cancelProposal xử lý 204 không body', async () => {
    let called = 0;
    server.use(
      http.post(`${BASE_URL}/v1/chat/agent/proposals/${PROPOSAL}/cancel`, () => {
        called += 1;
        return new HttpResponse(null, { status: 204 });
      }),
    );

    await expect(cancelProposal(client(), PROPOSAL)).resolves.toBeUndefined();
    expect(called).toBe(1);
  });

  it('409 đã xác nhận: đơn cũ và thẻ PAYMENT đọc được từ ApiError.meta', async () => {
    server.use(
      http.post(`${BASE_URL}/v1/chat/agent/proposals/${PROPOSAL}/confirm`, () =>
        HttpResponse.json(
          {
            type: 'https://nexaticket.vn/errors/proposal-already-confirmed',
            title: 'proposal already confirmed',
            status: 409,
            code: 'PROPOSAL_ALREADY_CONFIRMED',
            detail: 'Đề xuất này đã được xác nhận — đơn NT-260925-FSQM90',
            meta: {
              order: { orderId: 'o1', orderNumber: 'NT-260925-FSQM90', totalVnd: 3_600_000 },
              action: paymentCard,
            },
          },
          { status: 409 },
        ),
      ),
    );

    const error = await confirmProposal(client(), PROPOSAL).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    const api = error as ApiError;
    expect(api.code).toBe('PROPOSAL_ALREADY_CONFIRMED');
    expect((api.meta?.action as PaymentCard).kind).toBe('PAYMENT');
    expect((api.meta?.order as { orderNumber: string }).orderNumber).toBe('NT-260925-FSQM90');
  });
});
