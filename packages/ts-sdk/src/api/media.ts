import type { ApiClient } from '../http/client';
import type { PosterUploadTicket } from '../types/media';

/** Xin một lượt tải ảnh bìa. Xem `types/media.ts` để biết ba bước đầy đủ. */
export async function requestPosterUpload(
  client: ApiClient,
  organizationId: string,
  contentType: string,
): Promise<PosterUploadTicket> {
  const response = await client.post<PosterUploadTicket>(
    `/v1/organizations/${organizationId}/uploads/poster`,
    { contentType },
  );
  return response.data;
}

/**
 * Tải file lên bằng URL đã ký.
 *
 * Dùng `fetch` trần chứ **không** dùng `ApiClient`: URL này trỏ thẳng vào kho vật thể, không phải
 * vào gateway. Gắn header `Authorization` của ta vào đó sẽ làm chữ ký S3 sai và kho từ chối —
 * chữ ký được tính trên tập header, nên thêm một cái là hỏng.
 *
 * `Content-Type` phải khớp đúng chuỗi ở `ticket.contentType`, vì kiểu ấy nằm trong chữ ký.
 */
export async function uploadPoster(ticket: PosterUploadTicket, file: File): Promise<string> {
  const response = await fetch(ticket.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': ticket.contentType },
    body: file,
  });

  if (!response.ok) {
    throw new Error(`Tải ảnh lên thất bại (${response.status})`);
  }
  return ticket.publicUrl;
}
