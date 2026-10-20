const DECIMAL = /^-?\d+(\.\d+)?$/;

/**
 * Formats a money amount that the API sent as a decimal string (`"25.50"`).
 * The string goes to `Intl` as it is: it is never turned into a `number`, so
 * large or precise values do not lose digits. A value that is not a decimal is
 * returned untouched, so a bug shows up on screen instead of as a wrong amount.
 */
export function formatMoney(amount: string, locale: string, currency: string): string {
  if (!DECIMAL.test(amount)) return amount;
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(
    amount as `${number}`,
  );
}

/** Formats an instant sent by the API (UTC) in the person's time zone. */
export function formatDateTime(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone,
  }).format(date);
}

export function formatDate(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(date);
}

/** The time zone the browser reports, used until the profile has one. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 86_400_000],
  ['hour', 3_600_000],
  ['minute', 60_000],
];

/**
 * How long ago an instant was ("12 minutes ago", "now"), in the language of the interface.
 * A moment in the future or an unreadable value is shown as the plain date and time instead.
 */
export function formatRelative(iso: string, locale: string, now: number, timeZone: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time) || time > now) return formatDateTime(iso, locale, timeZone);
  const elapsed = now - time;
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  for (const [unit, size] of UNITS) {
    if (elapsed >= size) return formatter.format(-Math.floor(elapsed / size), unit);
  }
  return formatter.format(0, 'second');
}

/** The time of day with the seconds, in the person's time zone ("21:42:10"). */
export function formatTime(iso: string, locale: string, timeZone: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale, { timeStyle: 'medium', timeZone }).format(date);
}

/**
 * How long is left, as a clock ("00:12:40"), with the days in front when there are more than a day
 * ("2d 03:12:40"). Zero or less is "00:00:00": the countdown never goes negative.
 */
export function formatCountdown(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(total / 86_400);
  const rest = total % 86_400;
  const pad = (value: number) => String(value).padStart(2, '0');
  const clock = `${pad(Math.floor(rest / 3600))}:${pad(Math.floor((rest % 3600) / 60))}:${pad(rest % 60)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}
