/**
 * Danh mục sự kiện — nguồn duy nhất cho cả app khách lẫn app ban tổ chức.
 *
 * Khai ở đây vì backend chưa có endpoint liệt kê danh mục: `GET /v1/events` nhận `category` làm
 * tham số lọc, còn cột `catalog.events.category` là `TEXT` không ràng buộc. Nghĩa là danh sách
 * hợp lệ chỉ tồn tại ở frontend, nên nó phải tồn tại đúng **một lần**.
 *
 * Trước đây ba nơi khai ba bản: app khách ghi "Ca nhạc", app tổ chức ghi "Nhạc sống", cùng trỏ
 * vào `nhac-song`. Ban tổ chức chọn một chữ rồi khách nhìn thấy một chữ khác cho cùng sự kiện.
 *
 * `value` phải khớp đúng chuỗi lưu trong database, nếu không bộ lọc trả về rỗng mà không báo lỗi.
 * Khi backend có endpoint danh mục thì bỏ file này và lấy từ API.
 */
export interface EventCategory {
  value: string;
  label: string;
}

export const EVENT_CATEGORIES: EventCategory[] = [
  { value: 'nhac-song', label: 'Ca nhạc' },
  { value: 'san-khau', label: 'Sân khấu & Nghệ thuật' },
  { value: 'the-thao', label: 'Thể thao' },
  { value: 'hoi-thao', label: 'Hội thảo' },
  { value: 'khac', label: 'Khác' },
];

/**
 * Nhãn hiển thị của một danh mục.
 *
 * Giá trị lạ thì trả về chính nó chứ không để trống: cột trong database là text tự do, một sự
 * kiện cũ có thể mang giá trị không nằm trong danh sách này, và hiện ra chuỗi thô vẫn tốt hơn
 * là một thẻ sự kiện thiếu nhãn.
 */
export function eventCategoryLabel(value: string): string {
  return EVENT_CATEGORIES.find((item) => item.value === value)?.label ?? value;
}

/** Dùng cho chip lọc và thanh danh mục, có thêm mục "Tất cả" ở đầu. */
export const EVENT_CATEGORY_FILTERS: EventCategory[] = [
  { value: 'all', label: 'Tất cả' },
  ...EVENT_CATEGORIES,
];
