import { useNetInfo } from '@react-native-community/netinfo';
import { ApiError } from '@nexaticket/ts-sdk';

/**
 * Máy có đang ra được internet không.
 *
 * `isInternetReachable` là `null` lúc NetInfo chưa kịp thử — coi như CÓ mạng cho tới khi biết chắc
 * là không, để màn hình không nháy dải "offline" mỗi lần mở. Lượt gọi API hỏng vì mạng vẫn rơi về
 * soát offline ngay (xem `isNetworkFailure`), nên đoán lạc quan ở đây không làm mất lượt quét nào.
 */
export function useOnline(): boolean {
  const state = useNetInfo();
  if (state.isConnected === false) return false;
  return state.isInternetReachable !== false;
}

/** Lỗi do mạng (không có phản hồi), không phải server từ chối. */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof ApiError ? error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT' : error instanceof TypeError;
}
