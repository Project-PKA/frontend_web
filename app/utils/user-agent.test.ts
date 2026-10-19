import { describe, expect, it } from 'vitest';
import { describeUserAgent } from './user-agent';

const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WINDOWS = `${CHROME_WINDOWS} Edg/126.0.0.0`;
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const CHROME_ANDROID =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const SAFARI_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';

describe('describeUserAgent', () => {
  it.each([
    [CHROME_WINDOWS, 'Chrome', 'Windows'],
    [SAFARI_IPHONE, 'Safari', 'iOS'],
    [EDGE_WINDOWS, 'Edge', 'Windows'],
    [FIREFOX_LINUX, 'Firefox', 'Linux'],
    [CHROME_ANDROID, 'Chrome', 'Android'],
    [SAFARI_MAC, 'Safari', 'macOS'],
  ])('reads %#', (userAgent, browser, system) => {
    expect(describeUserAgent(userAgent)).toEqual({ browser, system });
  });

  it('does not guess what it does not know', () => {
    expect(describeUserAgent('curl/8.0')).toEqual({ browser: null, system: null });
    expect(describeUserAgent('')).toEqual({ browser: null, system: null });
    expect(describeUserAgent(null)).toEqual({ browser: null, system: null });
  });
});
