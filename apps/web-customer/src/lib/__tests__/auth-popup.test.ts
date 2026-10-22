import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleSignInEnabled } from '../auth-providers';
import { openAuthPopup, redirectToAuth } from '../auth-popup';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('openAuthPopup', () => {
  it('mở /auth/start với đúng mode, căn giữa cửa sổ hiện tại', () => {
    Object.assign(window, { screenLeft: 100, screenTop: 50, outerWidth: 1280, outerHeight: 900 });
    const popup = { closed: false } as Window;
    const open = vi.spyOn(window, 'open').mockReturnValue(popup);

    expect(openAuthPopup('register')).toBe(popup);

    const [url, name, features] = open.mock.calls[0]!;
    expect(url).toBe('/auth/start?mode=register');
    expect(name).toBe('nexaticket-auth');
    // left = 100 + (1280 - 480) / 2 = 500; top = 50 + (900 - 720) / 2 = 140.
    expect(features).toBe('popup=yes,width=480,height=720,left=500,top=140');
  });

  it('trình duyệt chặn popup (null hoặc đã đóng ngay) thì trả null để nơi gọi rơi về chuyển trang', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openAuthPopup('login')).toBeNull();

    vi.spyOn(window, 'open').mockReturnValue({ closed: true } as Window);
    expect(openAuthPopup('google')).toBeNull();
  });

  it('cửa sổ nhỏ hơn popup thì không đặt toạ độ âm', () => {
    Object.assign(window, { screenLeft: 0, screenTop: 0, outerWidth: 300, outerHeight: 400 });
    const open = vi.spyOn(window, 'open').mockReturnValue({ closed: false } as Window);
    openAuthPopup('login');
    expect(open.mock.calls[0]![2]).toContain('left=0,top=0');
  });
});

describe('redirectToAuth', () => {
  const realLocation = window.location;
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
  });

  it('mã hoá returnTo thành tham số truy vấn, không ghép chuỗi trần', () => {
    const location = { href: '' };
    Object.defineProperty(window, 'location', { configurable: true, value: location });

    redirectToAuth('login', '/events/a?x=1&y=2#suat');

    const url = new URL(location.href, 'http://app.test');
    expect(url.pathname).toBe('/auth/start');
    expect(url.searchParams.get('mode')).toBe('login');
    expect(url.searchParams.get('returnTo')).toBe('/events/a?x=1&y=2#suat');
  });
});

describe('googleSignInEnabled', () => {
  it('chỉ bật khi biến môi trường đúng là "true"', () => {
    vi.stubEnv('AUTH_GOOGLE_ENABLED', 'true');
    expect(googleSignInEnabled()).toBe(true);
    vi.stubEnv('AUTH_GOOGLE_ENABLED', '1');
    expect(googleSignInEnabled()).toBe(false);
    vi.stubEnv('AUTH_GOOGLE_ENABLED', '');
    expect(googleSignInEnabled()).toBe(false);
  });
});
