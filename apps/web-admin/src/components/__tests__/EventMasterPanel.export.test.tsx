import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EventMasterPanel } from '../EventMasterPanel';
import { masterData, ORG } from './event-master-fixture';

/** Blob của jsdom không có `arrayBuffer()`; FileReader thì có. */
function readBytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/**
 * Bấm nút xuất trên CHÍNH màn hình quản trị, bắt file trình duyệt nhận được.
 *
 * Test của `toXlsx` chứng minh bộ ghi đúng; test này chứng minh nút gọi đúng bộ ghi, đúng tên file,
 * đúng loại MIME — thứ duy nhất người dùng thấy khi bấm.
 */
describe('EventMasterPanel — nút xuất báo cáo', () => {
  let container: HTMLDivElement;
  let root: Root;
  let blobs: Blob[];
  let filenames: string[];

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    blobs = [];
    filenames = [];
    // jsdom không có URL.createObjectURL và không tải file thật: bắt blob và tên file ở đây.
    URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:test';
    });
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filenames.push(this.download);
    });

    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root.render(<EventMasterPanel data={masterData()} organization={ORG} />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function button(label: string): HTMLButtonElement {
    const found = [...container.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(label),
    );
    if (!found) throw new Error(`không thấy nút "${label}"`);
    return found;
  }

  it('nút "Xuất Excel" tải về một file .xlsx thật — zip, đúng MIME, tên theo tổ chức và sự kiện', async () => {
    act(() => button('Xuất Excel').click());

    expect(filenames).toHaveLength(1);
    expect(filenames[0]).toMatch(/^ban-to-chuc-ha-dem-nhac-ha-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(blobs[0]!.type).toBe(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );

    const bytes = await readBytes(blobs[0]!);
    // "PK\x03\x04": chữ ký đầu mọi file zip, mà .xlsx là một file zip.
    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = new TextDecoder().decode(bytes);
    expect(text).toContain('<sheet name="BÁO CÁO SỰ KIỆN"');
    expect(text).toContain('Đêm nhạc Hạ');
  });

  it('nút "Xuất CSV" vẫn còn và vẫn ra file .csv', () => {
    act(() => button('Xuất CSV').click());

    expect(filenames).toHaveLength(1);
    expect(filenames[0]).toMatch(/\.csv$/);
    expect(blobs[0]!.type).toBe('text/csv;charset=utf-8');
  });
});
