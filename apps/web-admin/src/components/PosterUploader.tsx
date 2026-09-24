'use client';

import { ApiError, requestPosterUpload, uploadPoster, useApiClient } from '@nexaticket/ts-sdk';
import { Button, coverGradient, errorMessage } from '@nexaticket/ui';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import styles from './poster-uploader.module.css';

export interface PosterUploaderProps {
  organizationId: string;
  /** Ảnh hiện tại. `null` hoặc rỗng nghĩa là chưa có. */
  posterUrl: string | null;
  /** Khoá sinh ảnh nền tạm — dùng slug để trùng với thứ khách nhìn thấy. */
  coverSeed: string;
  /**
   * Lưu đường dẫn mới vào sự kiện.
   *
   * Chuỗi rỗng nghĩa là **xoá ảnh**, khác hẳn `null`. Backend phân biệt hai thứ đó
   * (`PosterUrlPolicy`): `null` là "không đổi gì", rỗng là "xoá".
   */
  onSave: (posterUrl: string) => Promise<void>;
}

/** Kiểu ảnh backend chấp nhận. Giữ khớp với `nexaticket.catalog.media.allowed-content-types`. */
const ACCEPTED = 'image/jpeg,image/png,image/webp';

/**
 * Chọn và tải ảnh bìa sự kiện.
 *
 * <h3>Ba bước, nhưng người dùng chỉ thấy một</h3>
 *
 * Bên dưới là: xin URL đã ký → `PUT` thẳng lên kho vật thể → lưu đường dẫn vào sự kiện. Byte ảnh
 * không đi qua backend (xem `types/media.ts` của SDK).
 *
 * Nếu bước 3 hỏng — ảnh quá nặng, sai định dạng — thì vật thể vừa tải lên trở thành file mồ côi và
 * backend tự xoá nó. Nên ở đây không cần dọn dẹp gì, chỉ cần hiện đúng lỗi.
 *
 * <h3>Chặn kích thước ở cả hai đầu</h3>
 *
 * Kiểm ngay khi chọn file là để khách không phải chờ tải xong 40 MB rồi mới bị từ chối. Nhưng nó
 * **không** thay được phần kiểm ở backend: một client tự viết vẫn gọi thẳng API được, và trần thật
 * nằm ở `PosterUrlPolicy`.
 */
export function PosterUploader({
  organizationId,
  posterUrl,
  coverSeed,
  onSave,
}: PosterUploaderProps) {
  const client = useApiClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  async function choose(file: File) {
    setFailure(null);
    setBusy(true);
    try {
      const ticket = await requestPosterUpload(client, organizationId, file.type);

      if (file.size > ticket.maxBytes) {
        // Trần do backend gửi xuống, không phải hằng số ở đây: hai nơi khai cùng một con số là
        // hai nơi để lệch, và bên lệch sẽ là bên từ chối nhầm một tấm ảnh hợp lệ.
        setFailure(`Ảnh nặng quá ${Math.round(ticket.maxBytes / 1024 / 1024)} MB.`);
        return;
      }

      const publicUrl = await uploadPoster(ticket, file);
      await onSave(publicUrl);
    } catch (error) {
      setFailure(error instanceof ApiError ? errorMessage(error) : (error as Error).message);
    } finally {
      setBusy(false);
      // Xoá giá trị của input: không xoá thì chọn lại ĐÚNG file vừa chọn sẽ không bắn sự kiện
      // `change` nào, và nút trông như bị hỏng sau một lần tải thất bại.
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function clear() {
    setFailure(null);
    setBusy(true);
    try {
      // Chuỗi rỗng, KHÔNG phải null: backend đọc null là "không đổi gì".
      await onSave('');
    } catch (error) {
      setFailure(error instanceof ApiError ? errorMessage(error) : (error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div
        className={styles.preview}
        style={posterUrl ? undefined : { background: coverGradient(coverSeed) }}
      >
        {/*
          `<img>` thường chứ không phải `next/image`: ảnh nằm trên kho vật thể của chính mình, và
          bật tối ưu của Next cho một host cấu hình được lúc chạy nghĩa là phải khai `remotePatterns`
          cho một giá trị chỉ biết ở runtime.
        */}
        {/* eslint-disable-next-line @next/next/no-img-element -- host kho ảnh cấu hình được lúc
            chạy, nên `remotePatterns` của next/image không khai trước được. Đây cũng là màn quản
            trị: một người xem, không có ngân sách LCP như trang khách. */}
        {posterUrl ? <img src={posterUrl} alt="Ảnh bìa hiện tại" /> : null}
        {!posterUrl ? <span className={styles.empty}>Chưa có ảnh bìa</span> : null}
      </div>

      <div className={styles.actions}>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className={styles.input}
          id="poster-file"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void choose(file);
          }}
        />
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
        >
          <ImageUp size={18} aria-hidden="true" />
          {posterUrl ? 'Đổi ảnh bìa' : 'Tải ảnh bìa'}
        </Button>

        {posterUrl ? (
          <Button variant="secondary" disabled={busy} onClick={() => void clear()}>
            <Trash2 size={18} aria-hidden="true" />
            Xoá ảnh
          </Button>
        ) : null}
      </div>

      <p className={styles.hint}>JPEG, PNG hoặc WebP. Tỷ lệ 16:9 hiển thị đẹp nhất.</p>

      {failure ? (
        <p className={styles.failure} role="alert">
          {failure}
        </p>
      ) : null}
    </div>
  );
}
