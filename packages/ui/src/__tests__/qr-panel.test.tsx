import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { QrCode } from '../components/QrCode';
import { QrPanel } from '../components/QrPanel';

/**
 * Khung của mã QR.
 *
 * Bài kiểm ở đây không phải về cái khung trông thế nào — mà về việc nó **không làm hỏng mã bên
 * trong**. Trang trí đè lên vùng yên tĩnh cho ra một tấm mã vẫn đẹp và không quét được, và kiểu
 * hỏng ấy chỉ lộ ra ở cửa soát vé.
 */
describe('QrPanel', () => {
  it('không đụng vào mã bên trong — vẫn đúng từng ô như mã trần', () => {
    const value = 'eyJhbGciOiJFZERTQSJ9.payload.signature';

    const framed = render(<QrPanel value={value} label="Mã vào cửa" title="Mã vào cửa" />);
    const bare = render(<QrCode value={value} size={220} label="Mã vào cửa" />);

    // So chính đường vẽ của mã: khung chỉ được bọc BÊN NGOÀI. Một thay đổi dù nhỏ ở đây nghĩa là
    // có người đã vẽ đè vào mã.
    const framedPath = framed.container.querySelector('svg path')?.getAttribute('d');
    const barePath = bare.container.querySelector('svg path')?.getAttribute('d');

    expect(framedPath).toBeTruthy();
    expect(framedPath).toBe(barePath);
  });

  it('mã nằm trên tấm nền trắng, không nằm trên nền tối của trang', () => {
    // Máy quét tìm mã bằng tương phản sáng/tối. Ở giao diện tối, đặt mã thẳng lên nền trang làm
    // tương phản đảo ngược — một số máy đọc được, một số không.
    const { container } = render(<QrPanel value="abc" label="Mã" title="Mã vào cửa" />);

    const plate = container.querySelector('svg')?.parentElement;
    expect(plate?.className).toContain('plate');
  });

  it('bốn dấu góc bị ẩn khỏi trình đọc màn hình', () => {
    // Chúng là trang trí. Đọc lên thành bốn phần tử vô nghĩa xen giữa nội dung thật.
    const { container } = render(<QrPanel value="abc" label="Mã" title="Mã vào cửa" />);

    const corners = container.querySelectorAll('[aria-hidden="true"]');
    expect(corners).toHaveLength(4);
  });

  it('mã vé và mã chuyển khoản phân biệt được bằng lớp CSS', () => {
    // Hai loại mã này trông y hệt nhau. Quét mã vé bằng app ngân hàng thì không có gì xảy ra, và
    // đưa mã VietQR cho nhân viên soát vé cũng vậy — nên chúng phải khác màu.
    const ticket = render(<QrPanel value="a" label="l" title="Mã vào cửa" variant="ticket" />);
    const payment = render(<QrPanel value="a" label="l" title="Chuyển khoản" variant="payment" />);

    const ticketClass = ticket.container.querySelector('figure')!.className;
    const paymentClass = payment.container.querySelector('figure')!.className;

    expect(ticketClass).not.toBe(paymentClass);
  });

  it('nhãn trợ năng vẫn là nhãn của mã, không phải tiêu đề khung', () => {
    // Tiêu đề là chữ nhìn thấy được; `label` là thứ trình đọc màn hình đọc cho người không nhìn
    // thấy mã. Gộp hai thứ làm một thì mất một trong hai.
    render(<QrPanel value="a" label="Mã vào cửa cho vé Hạng A" title="Mã vào cửa" meta="Hạng A" />);

    expect(screen.getByLabelText('Mã vào cửa cho vé Hạng A')).toBeInTheDocument();
    expect(screen.getByText('Mã vào cửa')).toBeInTheDocument();
  });

  it('không có chú thích thì không dựng ô chú thích rỗng', () => {
    const { container } = render(<QrPanel value="a" label="l" title="Mã vào cửa" />);

    expect(container.querySelector('figcaption')).toBeNull();
  });
});
