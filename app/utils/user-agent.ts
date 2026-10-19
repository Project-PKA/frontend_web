export interface DeviceDescription {
  /** Browser family, or `null` when it is not one we recognise. */
  browser: string | null;
  /** Operating system, or `null` when it is not one we recognise. */
  system: string | null;
}

// Order matters: Edge and Opera also say "Chrome", and Chrome also says "Safari".
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\//, 'Chrome'],
  [/Safari\//, 'Safari'],
];

// iOS says "like Mac OS X", so it comes before macOS; Android says "Linux".
const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Android/, 'Android'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux/, 'Linux'],
];

function firstMatch(table: ReadonlyArray<[RegExp, string]>, value: string): string | null {
  return table.find(([pattern]) => pattern.test(value))?.[1] ?? null;
}

/** A short, readable description of the device from its `User-Agent` ("Chrome, Windows"). */
export function describeUserAgent(userAgent: string | null): DeviceDescription {
  if (!userAgent) return { browser: null, system: null };
  return { browser: firstMatch(BROWSERS, userAgent), system: firstMatch(SYSTEMS, userAgent) };
}
