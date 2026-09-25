/**
 * Gom khu thành hạng vé, cho những khán phòng có quá nhiều khu.
 *
 * Một nhà hát ba khu thì liệt kê phẳng là xong. Một nhà thi đấu 91 khu thì danh sách phẳng dài
 * hơn ba màn hình: phần tóm tắt đơn hàng trôi khỏi tầm nhìn, và khách phải cuộn qua sáu chục khu
 * hạng rẻ mới thấy hết. Gom lại theo hạng là cách duy nhất giữ được cả hai thứ trên một màn hình.
 *
 * Nằm ở `@nexaticket/ui` chứ không nằm cạnh màn hình dùng nó, vì một lý do rất cụ thể:
 * `apps/web-customer` chưa có bộ chạy test, còn hàm đặt tên nhóm bên dưới là một phép cắt chuỗi
 * bằng biểu thức chính quy — thứ hỏng mà không ai thấy, chỉ để lại một tiêu đề nhóm kỳ quặc.
 */

/** Đủ để gom nhóm. Nơi dùng giữ kiểu đầy đủ của mình. */
export interface ZoneLike {
  zoneCode: string;
  name: string;
  priceVnd: number;
  available: number;
}

export interface ZoneGroup<T extends ZoneLike> {
  priceVnd: number;
  /** Tên các "họ" khu trong nhóm, ví dụ "Sát sàn, Loge". */
  label: string;
  /** Tổng chỗ còn trống của cả nhóm. */
  available: number;
  zones: T[];
}

/**
 * Gom khu theo GIÁ, không theo tên.
 *
 * Giá là thứ thật sự chia hạng vé dưới mắt người mua: hai khu cùng giá là hai lựa chọn thay thế
 * được cho nhau, còn tên khu chỉ nói chỗ ngồi nằm ở đâu. Gom theo tên thì "Khán đài A · 101" và
 * "Khán đài A · 137" vào chung là đúng, nhưng "Sát sàn 5" với "Loge 3" — cùng giá, cùng hạng —
 * lại bị tách làm hai nhóm.
 *
 * Đắt nhất lên đầu, giống cách mọi bảng giá vé được đọc.
 */
export function groupZonesByPrice<T extends ZoneLike>(zones: T[]): Array<ZoneGroup<T>> {
  const byPrice = new Map<number, T[]>();
  for (const zone of zones) {
    const list = byPrice.get(zone.priceVnd) ?? [];
    list.push(zone);
    byPrice.set(zone.priceVnd, list);
  }

  return [...byPrice.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([priceVnd, group]) => ({
      priceVnd,
      label: zoneFamilyLabel(group),
      available: group.reduce((sum, zone) => sum + zone.available, 0),
      zones: group,
    }));
}

/**
 * Tên của một nhóm: những "họ" tên khu có trong đó.
 *
 * Cắt phần số ở cuối tên để "Khán đài A · 101" và "Khán đài A · 137" cùng cho ra "Khán đài A".
 * Cắt cả phần sau dấu "·" trước, vì đuôi ấy thường là nhãn hạng ("· Courtside") chứ không phải
 * tên khu — giữ lại thì mỗi khu thành một họ riêng và nhãn nhóm dài bằng cả danh sách.
 *
 * Trộn nhiều họ thì liệt kê, tối đa ba: dài hơn thì tiêu đề nuốt mất con số đứng cạnh nó.
 */
export function zoneFamilyLabel(zones: ZoneLike[]): string {
  const families: string[] = [];

  for (const zone of zones) {
    const head = zone.name.split('·')[0] ?? zone.name;
    // Chữ cái sau số là để bắt "9A", "9B" — khu tách đôi vẫn thuộc cùng một họ với khu số 9.
    const family = head.replace(/\s*\d+[A-Za-zÀ-ỹ]?\s*$/u, '').trim() || zone.name.trim();
    if (family && !families.includes(family)) families.push(family);
  }

  if (families.length === 0) return 'Hạng vé';
  return families.length > 3 ? `${families.slice(0, 3).join(', ')}…` : families.join(', ');
}
