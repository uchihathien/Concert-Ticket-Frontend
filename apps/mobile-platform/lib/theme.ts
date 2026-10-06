/**
 * Bảng màu của app Superadmin — đồng bộ với web Superadmin (apps/web-platform).
 *
 * Giá trị chép từ `@nexaticket/tokens/admin.css` (`:root[data-app='platform']`): nền sáng
 * slate, màu chính indigo. React Native không đọc được CSS custom property, nên đây là bản sao
 * có chủ đích — sửa token web thì sửa cả ở đây.
 */
export const theme = {
  canvas: '#f1f5f9', // --nt-bg-subtle: nền khung
  bg: '#f8fafc', // --nt-bg
  surface: '#ffffff', // --nt-surface: thẻ, header, ô nhập
  border: '#e2e8f0', // --nt-border
  hover: '#f1f5f9', // --nt-hover
  text: '#0f172a', // --nt-text — 17.85:1 trên trắng
  muted: '#475569', // --nt-text-muted — 7.58:1 trên trắng
  primary: '#4f46e5', // --nt-primary: nền nút
  primaryPressed: '#4338ca', // --nt-primary-hover
  primaryInk: '#ffffff', // chữ trên nút — 6.29:1
  primaryText: '#4338ca', // --nt-primary-text: link, mục đang chọn — 7.90:1
  primarySoft: '#eef0fd', // nền mục nav đang chọn (indigo 9% trên trắng, như web)
  accent: '#e0e7ff', // --nt-accent: nền chip
  accentInk: '#3730a3', // --nt-accent-ink
  successText: '#047857', // --nt-success-text
  warnText: '#b45309', // --nt-warn-text
  danger: '#e11d48', // --nt-danger
  dangerText: '#be123c', // --nt-danger-text
  dangerSoft: '#fff1f2',
  radius: 8, // --nt-radius
  radiusLg: 12, // --nt-radius-lg
} as const;
