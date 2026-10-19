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
