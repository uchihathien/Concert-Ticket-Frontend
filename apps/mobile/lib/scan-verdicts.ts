import type { GateScanResponse, GateScanResult } from '@nexaticket/ts-sdk';
import { Vibration } from 'react-native';

/**
 * Bốn màu, bốn nghĩa — nhân viên nhìn màu trước khi kịp đọc chữ:
 * xanh lá cho vào · xanh dương ghi nhận ra · đỏ chặn lại · cam xem lại với khách.
 */
export type VerdictTone = 'enter' | 'exit' | 'deny' | 'warn';

export const TONE_COLORS: Record<VerdictTone, { border: string; background: string; text: string }> = {
  enter: { border: '#77B44A', background: '#1D2B1E', text: '#D5FF66' },
  exit: { border: '#4A90E2', background: '#182536', text: '#8CC2FF' },
  deny: { border: '#D0553D', background: '#2E1B18', text: '#FF9B84' },
  warn: { border: '#D9902F', background: '#2C2416', text: '#FFC773' },
};

const VERDICTS: Record<GateScanResult, { tone: VerdictTone; title: string; hint: string }> = {
  ACCEPTED: { tone: 'enter', title: 'MỜI VÀO', hint: 'Vé hợp lệ.' },
  EXITED: { tone: 'exit', title: 'ĐÃ GHI NHẬN RA', hint: 'Khách có thể quét Vào để quay lại.' },
  ALREADY_CHECKED_IN: { tone: 'deny', title: 'ĐANG Ở TRONG', hint: 'Vé này đang được ghi nhận là ở trong khu vực.' },
  INVALID_TOKEN: { tone: 'deny', title: 'MÃ KHÔNG HỢP LỆ', hint: 'Mã sai hoặc đã hết hạn.' },
  NOT_FOUND: { tone: 'deny', title: 'KHÔNG TÌM THẤY VÉ', hint: 'Không có vé ứng với mã này.' },
  REVOKED: { tone: 'deny', title: 'VÉ ĐÃ HUỶ', hint: 'Vé bị thu hồi hoặc đã hoàn tiền.' },
  NOT_INSIDE: { tone: 'warn', title: 'CHƯA VÀO', hint: 'Vé chưa vào hoặc đã ra ngoài.' },
  WRONG_SESSION: { tone: 'warn', title: 'SAI SUẤT DIỄN', hint: 'Vé thuộc một suất diễn khác.' },
  NOT_OPEN_YET: { tone: 'warn', title: 'CHƯA MỞ CỔNG', hint: 'Chưa tới giờ mở cổng của suất này.' },
  SESSION_ENDED: { tone: 'warn', title: 'SUẤT ĐÃ KẾT THÚC', hint: 'Suất diễn này không còn nhận khách.' },
  REENTRY_NOT_ALLOWED: { tone: 'warn', title: 'KHÔNG ĐƯỢC VÀO LẠI', hint: 'Sự kiện không cho phép vào lại.' },
};

export function verdictOf(response: Pick<GateScanResponse, 'result' | 'entryCount'>) {
  const verdict = VERDICTS[response.result];
  if (response.result === 'ACCEPTED' && response.entryCount > 1) {
    return { ...verdict, title: 'MỜI VÀO LẠI', hint: `Lần vào thứ ${response.entryCount} của vé này.` };
  }
  return verdict;
}

/** Tên ngắn của kết quả, cho dòng lịch sử. */
export function resultLabel(result: GateScanResult): string {
  return VERDICTS[result].title;
}

export function toneOf(result: GateScanResult): VerdictTone {
  return VERDICTS[result].tone;
}

/**
 * Rung khác nhau cho từng nghĩa: ở cửa vào ồn và nhân viên thường không nhìn màn hình khi đang đưa
 * máy về phía khách. Một nhịp ngắn là cho qua, hai nhịp là ra, một hồi dài là dừng lại.
 */
export function vibrateFor(tone: VerdictTone) {
  if (tone === 'enter') Vibration.vibrate(70);
  else if (tone === 'exit') Vibration.vibrate([0, 60, 90, 60]);
  else if (tone === 'warn') Vibration.vibrate([0, 180, 120, 180]);
  else Vibration.vibrate(600);
}

export function formatClock(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

export function formatSessionDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
