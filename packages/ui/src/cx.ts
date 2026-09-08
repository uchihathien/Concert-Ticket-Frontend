/**
 * Ghép class name.
 *
 * `noUncheckedIndexedAccess` khiến mọi khoá của CSS Module có kiểu `string | undefined`, nên
 * phải lọc rỗng ở một chỗ thay vì rải `!` khắp nơi.
 */
export function cx(...values: Array<string | false | null | undefined>): string {
  return values.filter((value): value is string => Boolean(value)).join(' ');
}
