const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080';

export function resolveMediaUrl(value: string | null | undefined): string | undefined {
  if (!value) return undefined;

  try {
    const mediaUrl = new URL(value);
    const apiHost = new URL(apiBaseUrl).hostname;
    if (mediaUrl.hostname === 'localhost' || mediaUrl.hostname === '127.0.0.1') {
      mediaUrl.hostname = apiHost;
    }
    return mediaUrl.toString();
  } catch {
    return value;
  }
}