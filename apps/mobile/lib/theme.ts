/**
 * Bảng màu của app Superadmin — CÙNG tông với app Organizer và Scanner (nền tối xanh lá, nhấn xanh
 * chanh), và với web Superadmin/Tổ chức (organizer-theme.css, platform-theme.css).
 *
 * Giá trị lấy từ StyleSheet của apps/mobile-organizer. React Native không đọc được CSS custom
 * property, nên đây là bản sao có chủ đích — đổi tông thì đổi cả các nơi trên.
 */
export const theme = {
  canvas: '#111713', // nền màn hình
  bg: '#151d17', // header, thanh mục
  surface: '#19221b', // thẻ
  border: '#344238',
  line: '#28342b', // đường kẻ header
  hover: '#212c23',
  text: '#f1f5f1',
  muted: '#a6b1a8',
  label: '#aeb9b0', // nhãn ô nhập
  primary: '#d5ff66', // nền nút, mục đang chọn
  primaryPressed: '#c4f04f',
  primaryInk: '#17210d', // chữ trên nền xanh chanh — 14.6:1
  primaryText: '#d5ff66', // link, nhấn
  primarySoft: '#26342a', // nền mục nav đang chọn
  accent: '#26342a',
  accentInk: '#d5ff66',
  inputBg: '#151d17',
  inputBorder: '#3b493f',
  successText: '#5dd39e',
  warnText: '#ffd36b',
  danger: '#c53030',
  dangerText: '#ff8c79',
  dangerSoft: '#2a201d',
  dangerBorder: '#b8624c',
  radius: 8,
  radiusLg: 10,
} as const;
